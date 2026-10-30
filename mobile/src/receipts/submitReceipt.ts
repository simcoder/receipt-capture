import { applyProcessorResult, candidateMatches, type SeedTransaction } from "../../../src/domain/matching.ts";
import { resolveSubmit } from "../../../src/domain/idempotency.ts";
import type { ReceiptStatus } from "../../../src/domain/receiptState.ts";
import { ApiTransportError, apiErrorMessage, apiRequest } from "../api/client.ts";
import { quarantineImage } from "./quarantineImage.ts";
import type { KeyValueStore } from "../storage/localQueue.ts";

export const SEED_TRANSACTIONS: readonly SeedTransaction[] = [
  {
    id: "txn-blue-bottle",
    companyId: "northwind",
    merchant: "Blue Bottle",
    money: { amountMinor: 1850, currency: "USD" },
  },
  {
    id: "txn-parking",
    companyId: "northwind",
    merchant: "Airport Parking",
    money: { amountMinor: 2200, currency: "USD" },
  },
  {
    id: "txn-contoso-cafe",
    companyId: "contoso",
    merchant: "Contoso Cafe",
    money: { amountMinor: 975, currency: "USD" },
  },
];

export type SubmitResult = {
  receiptId: string;
  status: ReceiptStatus;
  replayed: boolean;
  source: "api" | "local-fake";
  matchedTransactionId?: string;
};

type StoredReceipt = {
  receiptId: string;
  companyId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
  status: ReceiptStatus;
  matchedTransactionId?: string;
  userCorrected?: boolean;
};

type FakeState = {
  records: { key: string; companyId: string; receiptId: string }[];
  receipts: StoredReceipt[];
};

export function fakeKey(companyId: string): string {
  return `receipt-capture.fake.${companyId.trim()}`;
}

export function amountDecimal(amountMinor: number): string {
  const whole = Math.trunc(amountMinor / 100);
  const fraction = String(Math.abs(amountMinor % 100)).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function submitRequest(input: {
  apiUrl: string;
  idToken: string;
  idempotencyKey: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
}): { url: string; init: RequestInit } {
  const url = `${input.apiUrl.replace(/\/$/, "")}/receipts`;
  return {
    url,
    init: {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.idToken}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey,
      },
      body: JSON.stringify({
        merchant: input.merchant,
        amount: amountDecimal(input.amountMinor),
        currency: input.currency,
        date: input.date,
      }),
    },
  };
}

export async function submitReceipt(input: {
  store: KeyValueStore;
  companyId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
  idempotencyKey: string;
  idToken: string | null;
  apiUrl: string;
  offline: boolean;
  imageBase64?: string;
  fetchImpl?: typeof fetch;
}): Promise<SubmitResult> {
  const canCallApi = !input.offline && Boolean(input.apiUrl) && Boolean(input.idToken);
  if (!canCallApi) {
    return saveFake(input.store, input);
  }

  const imageBase64 = input.imageBase64 ? quarantineImage(input.imageBase64) : undefined;
  const request = { ...input, imageBase64 };
  try {
    return await postReceipt(request);
  } catch (firstError) {
    if (!isTransportFailure(firstError)) throw firstError;
    try {
      return await postReceipt(request);
    } catch (secondError) {
      if (!isTransportFailure(secondError)) throw secondError;
      return saveFake(input.store, input);
    }
  }
}

export async function clearFake(store: KeyValueStore, companyId: string): Promise<void> {
  await store.removeItem(fakeKey(companyId));
}

async function postReceipt(input: {
  apiUrl: string;
  idToken: string | null;
  idempotencyKey: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
  imageBase64?: string;
  fetchImpl?: typeof fetch;
}): Promise<SubmitResult> {
  const result = await apiRequest({
    apiUrl: input.apiUrl,
    idToken: input.idToken,
    path: "/receipts",
    method: "POST",
    headers: { "idempotency-key": input.idempotencyKey },
    body: {
      merchant: input.merchant,
      amount: amountDecimal(input.amountMinor),
      currency: input.currency,
      date: input.date,
      ...(input.imageBase64 ? { imageBase64: input.imageBase64 } : {}),
    },
    fetchImpl: input.fetchImpl,
  });
  if (result.status >= 500) throw new ApiTransportError();
  if (!result.ok) throw new Error(apiErrorMessage(result.payload, "Submit failed"));
  const payload = result.payload;
  if (!payload || typeof payload !== "object" || !("receipt" in payload)) {
    throw new Error("Submit failed");
  }
  const receipt = payload.receipt;
  if (!receipt || typeof receipt !== "object") {
    throw new Error("Submit failed");
  }
  const receiptId = "receiptId" in receipt ? receipt.receiptId : undefined;
  const status = "status" in receipt ? receipt.status : undefined;
  if (typeof receiptId !== "string" || typeof status !== "string") {
    throw new Error("Submit failed");
  }
  const replayed = "replayed" in payload && payload.replayed === true;
  const matchedTransactionId =
    "matchedTransactionId" in receipt && typeof receipt.matchedTransactionId === "string"
      ? receipt.matchedTransactionId
      : undefined;
  return {
    receiptId,
    status: status as ReceiptStatus,
    replayed,
    source: "api",
    ...(matchedTransactionId ? { matchedTransactionId } : {}),
  };
}

async function saveFake(
  store: KeyValueStore,
  input: {
    companyId: string;
    merchant: string;
    amountMinor: number;
    currency: string;
    date: string;
    idempotencyKey: string;
  },
): Promise<SubmitResult> {
  const state = await loadFake(store, input.companyId);
  const proposedId = `fake-${input.idempotencyKey}`;
  const resolution = resolveSubmit(state.records, {
    key: input.idempotencyKey,
    companyId: input.companyId,
    receiptId: proposedId,
  });
  if (resolution.replayed) {
    const existing = state.receipts.find((receipt) => receipt.receiptId === resolution.receiptId);
    if (!existing) {
      throw new Error("stored receipt is missing");
    }
    return {
      receiptId: existing.receiptId,
      status: existing.status,
      replayed: true,
      source: "local-fake",
      ...(existing.matchedTransactionId ? { matchedTransactionId: existing.matchedTransactionId } : {}),
    };
  }

  const transactions = withTakenTransactions(SEED_TRANSACTIONS, state.receipts);
  const decision = applyProcessorResult(
    { status: "Processing", userCorrected: false },
    processorResult(input, resolution.receiptId, transactions),
  );
  const stored: StoredReceipt = {
    receiptId: resolution.receiptId,
    companyId: input.companyId,
    merchant: input.merchant,
    amountMinor: input.amountMinor,
    currency: input.currency,
    date: input.date,
    status: decision.status,
    ...(decision.matchedTransactionId ? { matchedTransactionId: decision.matchedTransactionId } : {}),
  };
  const next: FakeState = {
    records: resolution.records,
    receipts: [...state.receipts, stored],
  };
  await store.setItem(fakeKey(input.companyId), JSON.stringify(next));
  return {
    receiptId: stored.receiptId,
    status: stored.status,
    replayed: false,
    source: "local-fake",
    ...(stored.matchedTransactionId ? { matchedTransactionId: stored.matchedTransactionId } : {}),
  };
}

function processorResult(
  input: { companyId: string; merchant: string; amountMinor: number; currency: string },
  receiptId: string,
  transactions: readonly SeedTransaction[],
) {
  const matches = candidateMatches(
    {
      id: receiptId,
      companyId: input.companyId,
      merchant: input.merchant,
      money: { amountMinor: input.amountMinor, currency: input.currency },
    },
    transactions,
  );
  const strong = matches.find((match) => match.similarity >= 0.8);
  if (!strong) return { kind: "needs_review" as const };
  return { kind: "confirmed" as const, transactionId: strong.transactionId };
}

function withTakenTransactions(
  seeds: readonly SeedTransaction[],
  receipts: readonly StoredReceipt[],
): SeedTransaction[] {
  const taken = new Map(
    receipts
      .filter((receipt) => receipt.matchedTransactionId)
      .map((receipt) => [receipt.matchedTransactionId, receipt.receiptId]),
  );
  return seeds.map((transaction) => {
    const receiptId = taken.get(transaction.id);
    return receiptId ? { ...transaction, matchedReceiptId: receiptId } : transaction;
  });
}

async function loadFake(store: KeyValueStore, companyId: string): Promise<FakeState> {
  const raw = await store.getItem(fakeKey(companyId));
  if (!raw) return { records: [], receipts: [] };
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return { records: [], receipts: [] };
  const records = "records" in parsed && Array.isArray(parsed.records) ? parsed.records : [];
  const receipts = "receipts" in parsed && Array.isArray(parsed.receipts) ? parsed.receipts : [];
  return { records: records as FakeState["records"], receipts: receipts as StoredReceipt[] };
}

function isTransportFailure(error: unknown): boolean {
  return error instanceof ApiTransportError;
}
