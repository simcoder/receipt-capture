import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import {
  applyProcessorResult,
  candidateMatches,
  fakeProcessor,
  moneyFromDecimal,
  parseDateOnly,
  seedTransactions,
} from "./receiptRules.mjs";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const receiptsTable = process.env.RECEIPTS_TABLE;
const idempotencyTable = process.env.IDEMPOTENCY_TABLE;
const bucket = process.env.QUARANTINE_BUCKET;
const MAX_IMAGE_BYTES = 500_000;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function companyIdOf(event) {
  const claim = event.requestContext?.authorizer?.jwt?.claims?.["custom:company_id"];
  return typeof claim === "string" && claim.length > 0 ? claim : null;
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw);
}

async function listReceipts(companyId) {
  const result = await doc.send(
    new QueryCommand({
      TableName: receiptsTable,
      KeyConditionExpression: "companyId = :companyId",
      ExpressionAttributeValues: { ":companyId": companyId },
    }),
  );
  return result.Items ?? [];
}

function takenTransactionIds(receipts, exceptReceiptId) {
  return new Set(
    receipts
      .filter((receipt) => receipt.receiptId !== exceptReceiptId && receipt.matchedTransactionId)
      .map((receipt) => receipt.matchedTransactionId),
  );
}

function publicReceipt(item) {
  return {
    receiptId: item.receiptId,
    companyId: item.companyId,
    merchant: item.merchant,
    amountMinor: item.amountMinor,
    currency: item.currency,
    date: item.date,
    status: item.status,
    matchedTransactionId: item.matchedTransactionId ?? null,
    userCorrected: Boolean(item.userCorrected),
    objectKey: item.objectKey ?? null,
  };
}

async function createReceipt(companyId, event) {
  const idempotencyKey = event.headers?.["idempotency-key"]?.trim() ?? "";
  if (!idempotencyKey) return json(400, { error: "Idempotency-Key is required" });

  const existingKey = await doc.send(
    new GetCommand({
      TableName: idempotencyTable,
      Key: { companyId, idempotencyKey },
    }),
  );
  if (existingKey.Item) {
    const existing = await doc.send(
      new GetCommand({
        TableName: receiptsTable,
        Key: { companyId, receiptId: existingKey.Item.receiptId },
      }),
    );
    return json(200, { receipt: publicReceipt(existing.Item), replayed: true });
  }

  let body;
  try {
    body = parseBody(event);
  } catch {
    return json(400, { error: "body must be JSON" });
  }

  let money;
  let date;
  try {
    money = moneyFromDecimal(body.amount, body.currency);
    date = parseDateOnly(body.date);
  } catch (error) {
    return json(400, { error: error.message });
  }
  const merchant = String(body.merchant ?? "").trim();
  if (!merchant) return json(400, { error: "merchant is required" });

  const receiptId = randomUUID();
  const siblings = await listReceipts(companyId);
  const decision = applyProcessorResult(
    { status: "Processing", userCorrected: false },
    fakeProcessor(
      { id: receiptId, companyId, merchant, money },
      seedTransactions,
      takenTransactionIds(siblings),
    ),
  );

  let objectKey;
  if (body.imageBase64) {
    const encoded = String(body.imageBase64).replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      return json(400, { error: "image must be under 500 KB" });
    }
    objectKey = `quarantine/${companyId}/${receiptId}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: "application/octet-stream",
      }),
    );
  }

  const item = {
    companyId,
    receiptId,
    merchant,
    amountMinor: money.amountMinor,
    currency: money.currency,
    date,
    status: decision.status,
    matchedTransactionId: decision.matchedTransactionId,
    userCorrected: false,
    objectKey,
  };

  try {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: receiptsTable,
              Item: item,
              ConditionExpression: "attribute_not_exists(receiptId)",
            },
          },
          {
            Put: {
              TableName: idempotencyTable,
              Item: { companyId, idempotencyKey, receiptId },
              ConditionExpression: "attribute_not_exists(idempotencyKey)",
            },
          },
        ],
      }),
    );
  } catch (error) {
    if (error.name !== "TransactionCanceledException") throw error;
    const raced = await doc.send(
      new GetCommand({
        TableName: idempotencyTable,
        Key: { companyId, idempotencyKey },
      }),
    );
    if (!raced.Item) return json(409, { error: "submit conflicted; retry" });
    const stored = await doc.send(
      new GetCommand({
        TableName: receiptsTable,
        Key: { companyId, receiptId: raced.Item.receiptId },
      }),
    );
    return json(200, { receipt: publicReceipt(stored.Item), replayed: true });
  }

  return json(201, { receipt: publicReceipt(item), replayed: false });
}

async function matchReceipt(companyId, receiptId, event) {
  const current = await doc.send(
    new GetCommand({ TableName: receiptsTable, Key: { companyId, receiptId } }),
  );
  if (!current.Item) return json(404, { error: "receipt not found" });

  let body;
  try {
    body = parseBody(event);
  } catch {
    return json(400, { error: "body must be JSON" });
  }
  const transactionId = String(body.transactionId ?? "");
  const siblings = await listReceipts(companyId);
  const receipt = {
    id: receiptId,
    companyId,
    merchant: current.Item.merchant,
    money: { amountMinor: current.Item.amountMinor, currency: current.Item.currency },
  };
  const allowed = candidateMatches(
    receipt,
    seedTransactions,
    takenTransactionIds(siblings, receiptId),
  ).some((candidate) => candidate.transactionId === transactionId);
  if (!allowed) return json(409, { error: "transaction is not an open match" });

  await doc.send(
    new UpdateCommand({
      TableName: receiptsTable,
      Key: { companyId, receiptId },
      UpdateExpression:
        "SET #status = :status, matchedTransactionId = :transactionId, userCorrected = :userCorrected",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "Confirmed",
        ":transactionId": transactionId,
        ":userCorrected": true,
      },
    }),
  );

  return json(200, {
    receipt: publicReceipt({
      ...current.Item,
      status: "Confirmed",
      matchedTransactionId: transactionId,
      userCorrected: true,
    }),
  });
}

async function reprocess(companyId, receiptId) {
  const current = await doc.send(
    new GetCommand({ TableName: receiptsTable, Key: { companyId, receiptId } }),
  );
  if (!current.Item) return json(404, { error: "receipt not found" });

  const siblings = await listReceipts(companyId);
  const next = applyProcessorResult(
    {
      status: current.Item.status,
      userCorrected: Boolean(current.Item.userCorrected),
      matchedTransactionId: current.Item.matchedTransactionId,
    },
    fakeProcessor(
      {
        id: receiptId,
        companyId,
        merchant: current.Item.merchant,
        money: { amountMinor: current.Item.amountMinor, currency: current.Item.currency },
      },
      seedTransactions,
      takenTransactionIds(siblings, receiptId),
    ),
  );

  if (next.status !== current.Item.status || next.matchedTransactionId !== current.Item.matchedTransactionId) {
    await doc.send(
      new UpdateCommand({
        TableName: receiptsTable,
        Key: { companyId, receiptId },
        UpdateExpression: "SET #status = :status, matchedTransactionId = :transactionId",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": next.status,
          ":transactionId": next.matchedTransactionId ?? null,
        },
      }),
    );
  }

  return json(200, {
    receipt: publicReceipt({ ...current.Item, ...next }),
  });
}

export async function handler(event) {
  const companyId = companyIdOf(event);
  if (!companyId) return json(403, { error: "missing company claim" });

  const method = event.requestContext?.http?.method;
  const rawPath = event.rawPath ?? "";
  const receiptId = event.pathParameters?.receiptId;

  try {
    if (method === "POST" && receiptId && rawPath.endsWith("/match")) {
      return await matchReceipt(companyId, receiptId, event);
    }
    if (method === "POST" && receiptId && rawPath.endsWith("/reprocess")) {
      return await reprocess(companyId, receiptId);
    }
    if (method === "GET" && receiptId) {
      const found = await doc.send(
        new GetCommand({ TableName: receiptsTable, Key: { companyId, receiptId } }),
      );
      if (!found.Item) return json(404, { error: "receipt not found" });
      return json(200, { receipt: publicReceipt(found.Item) });
    }
    if (method === "GET" && rawPath.endsWith("/transactions")) {
      return json(200, {
        transactions: seedTransactions.filter((transaction) => transaction.companyId === companyId),
      });
    }
    if (method === "GET" && rawPath.endsWith("/receipts")) {
      const items = await listReceipts(companyId);
      return json(200, { receipts: items.map(publicReceipt) });
    }
    if (method === "POST" && rawPath.endsWith("/receipts")) {
      return await createReceipt(companyId, event);
    }
    return json(404, { error: "not found" });
  } catch (error) {
    console.error(error);
    return json(500, { error: "request failed" });
  }
}
