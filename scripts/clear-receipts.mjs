import { execFileSync } from "node:child_process";

const region = "us-east-1";
const stack = "ReceiptCapturePoc";

function aws(args) {
  return execFileSync("aws", [...args, "--region", region], { encoding: "utf8" });
}

function stackOutput(key) {
  const outputs = JSON.parse(
    aws(["cloudformation", "describe-stacks", "--stack-name", stack, "--query", "Stacks[0].Outputs", "--output", "json"]),
  );
  const found = outputs.find((item) => item.OutputKey === key);
  if (!found) throw new Error(`Missing stack output ${key}`);
  return found.OutputValue;
}

function scanAll(table) {
  const items = [];
  let startKey;
  do {
    const args = ["dynamodb", "scan", "--table-name", table, "--output", "json"];
    if (startKey) args.push("--exclusive-start-key", JSON.stringify(startKey));
    const page = JSON.parse(aws(args));
    items.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return items;
}

function deleteAll(table, items, keyNames) {
  for (let index = 0; index < items.length; index += 25) {
    const batch = items.slice(index, index + 25).map((item) => ({
      DeleteRequest: {
        Key: Object.fromEntries(keyNames.map((name) => [name, item[name]])),
      },
    }));
    aws([
      "dynamodb",
      "batch-write-item",
      "--request-items",
      JSON.stringify({ [table]: batch }),
      "--output",
      "json",
    ]);
  }
}

const receiptsTable = stackOutput("ReceiptsTableName");
const idempotencyTable = stackOutput("IdempotencyTableName");
const receipts = scanAll(receiptsTable);
const keys = scanAll(idempotencyTable);
deleteAll(receiptsTable, receipts, ["companyId", "receiptId"]);
deleteAll(idempotencyTable, keys, ["companyId", "idempotencyKey"]);
console.log(`Cleared ${receipts.length} receipts and ${keys.length} idempotency keys.`);
