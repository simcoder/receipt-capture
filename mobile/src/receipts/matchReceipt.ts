import {
  applyProcessorResult,
  applyUserCorrection,
  candidateMatches,
  confirmMatch,
  type SeedTransaction,
} from "../../../src/domain/matching.ts";
import type { ReceiptStatus } from "../../../src/domain/receiptState.ts";
import { ApiTransportError, apiErrorMessage, apiRequest } from "../api/client.ts";
import type { KeyValueStore } from "../storage/localQueue.ts";
import { SEED_TRANSACTIONS, fakeKey } from "./submitReceipt.ts";

export type MatchChoice = {
  transactionId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
};

export type MatchResult = {
  status: ReceiptStatus;
  matchedTransactionId: string;
  userCorrected: true;
};

type MatchReceipt = {
  receiptId: string;
  companyId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
  status: ReceiptStatus;
};

type Sibling = {
  receiptId?: string;
  matchedTransactionId?: string;
};

type FakeReceipt = {
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
  receipts: FakeReceipt[];
};

export function openMatches(receipt: MatchReceipt, siblings: readonly Sibling[]): MatchChoice[] {
  const choices = candidateMatches(
    {
      id: receipt.receiptId,
      companyId: receipt.companyId,
      merchant: receipt.merchant,
      money: { amountMinor: receipt.amountMinor, currency: receipt.currency },
    },
    seedsWithTaken(siblings),
  );
  return choices.map((choice) => {
    const transaction = SEED_TRANSACTIONS.find((item) => item.id === choice.transactionId);
    return {
      transactionId: choice.transactionId,
      merchant: transaction?.merchant ?? choice.transactionId,
      amountMinor: transaction?.money.amountMinor ?? receipt.amountMinor,
      currency: transaction?.money.currency ?? receipt.currency,
    };
  });
}

export async function confirmReceiptMatch(input: {
  store: KeyValueStore;
  siblings: readonly Sibling[];
  receipt: MatchReceipt;
  transactionId: string;
  idToken: string | null;
  apiUrl: string;
  offline: boolean;
  submitSource?: "api" | "local-fake";
  fetchImpl?: typeof fetch;
}): Promise<MatchResult> {
  if (input.receipt.status !== "NeedsReview") {
    throw new Error("match is only available from NeedsReview");
  }

  const localOnly =
    input.offline ||
    !input.apiUrl ||
    !input.idToken ||
    input.submitSource === "local-fake" ||
    input.receipt.receiptId.startsWith("fake-");
  if (localOnly) {
    return confirmLocally(input.store, input.siblings, input.receipt, input.transactionId);
  }

  try {
    return await postMatch(input);
  } catch (firstError) {
    if (!isTransportFailure(firstError)) throw firstError;
    try {
      return await postMatch(input);
    } catch (secondError) {
      if (!isTransportFailure(secondError)) throw secondError;
      return confirmLocally(input.store, input.siblings, input.receipt, input.transactionId);
    }
  }
}

export async function applyLateProcessor(
  store: KeyValueStore,
  companyId: string,
  receiptId: string,
): Promise<{ status: ReceiptStatus; matchedTransactionId?: string; userCorrected: boolean }> {
  const state = await readFake(store, companyId);
  const current = state.receipts.find((receipt) => receipt.receiptId === receiptId);
  if (!current) throw new Error("stored receipt is missing");
  const reviewStatus =
    current.status === "Confirmed" || current.status === "NeedsReview" || current.status === "Processing"
      ? current.status
      : "NeedsReview";
  const next = applyProcessorResult(
    {
      status: reviewStatus,
      userCorrected: current.userCorrected === true,
      ...(current.matchedTransactionId ? { matchedTransactionId: current.matchedTransactionId } : {}),
    },
    processorResult(current, seedsWithTaken(state.receipts)),
  );
  const updated: FakeReceipt = {
    ...current,
    status: next.status,
    userCorrected: next.userCorrected,
    ...(next.matchedTransactionId ? { matchedTransactionId: next.matchedTransactionId } : {}),
  };
  await writeFake(store, companyId, {
    ...state,
    receipts: state.receipts.map((receipt) => (receipt.receiptId === receiptId ? updated : receipt)),
  });
  return {
    status: updated.status,
    ...(updated.matchedTransactionId ? { matchedTransactionId: updated.matchedTransactionId } : {}),
    userCorrected: updated.userCorrected === true,
  };
}

function seedsWithTaken(siblings: readonly Sibling[]): SeedTransaction[] {
  const taken = new Map<string, string>();
  for (const sibling of siblings) {
    if (sibling.receiptId && sibling.matchedTransactionId) {
      taken.set(sibling.matchedTransactionId, sibling.receiptId);
    }
  }
  return SEED_TRANSACTIONS.map((transaction) => {
    const receiptId = taken.get(transaction.id);
    return receiptId ? { ...transaction, matchedReceiptId: receiptId } : transaction;
  });
}

async function confirmLocally(
  store: KeyValueStore,
  siblings: readonly Sibling[],
  receipt: MatchReceipt,
  transactionId: string,
): Promise<MatchResult> {
  const state = await readFake(store, receipt.companyId);
  const known = [
    ...siblings,
    ...state.receipts.map((item) => ({
      receiptId: item.receiptId,
      matchedTransactionId: item.matchedTransactionId,
    })),
  ];
  confirmMatch(
    {
      id: receipt.receiptId,
      companyId: receipt.companyId,
      merchant: receipt.merchant,
      money: { amountMinor: receipt.amountMinor, currency: receipt.currency },
    },
    transactionId,
    seedsWithTaken(known),
  );
  const corrected = applyUserCorrection({ status: "NeedsReview", userCorrected: false }, transactionId);
  await rememberMatch(store, receipt, corrected.matchedTransactionId ?? transactionId);
  return {
    status: corrected.status,
    matchedTransactionId: corrected.matchedTransactionId ?? transactionId,
    userCorrected: true,
  };
}

async function postMatch(input: {
  store: KeyValueStore;
  receipt: MatchReceipt;
  transactionId: string;
  idToken: string | null;
  apiUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<MatchResult> {
  const result = await apiRequest({
    apiUrl: input.apiUrl,
    idToken: input.idToken,
    path: `/receipts/${input.receipt.receiptId}/match`,
    method: "POST",
    body: { transactionId: input.transactionId },
    fetchImpl: input.fetchImpl,
  });
  if (result.status >= 500) throw new ApiTransportError();
  if (!result.ok) throw new Error(apiErrorMessage(result.payload, "Match failed"));
  const payload = result.payload;
  const body = payload && typeof payload === "object" && "receipt" in payload ? payload.receipt : null;
  if (!body || typeof body !== "object") throw new Error("Match failed");
  const status = "status" in body ? body.status : undefined;
  const matchedTransactionId = "matchedTransactionId" in body ? body.matchedTransactionId : undefined;
  if (status !== "Confirmed" || typeof matchedTransactionId !== "string") throw new Error("Match failed");
  await rememberMatch(input.store, input.receipt, matchedTransactionId);
  return { status, matchedTransactionId, userCorrected: true };
}

async function rememberMatch(store: KeyValueStore, receipt: MatchReceipt, transactionId: string): Promise<void> {
  const state = await readFake(store, receipt.companyId);
  const stored: FakeReceipt = {
    receiptId: receipt.receiptId,
    companyId: receipt.companyId,
    merchant: receipt.merchant,
    amountMinor: receipt.amountMinor,
    currency: receipt.currency,
    date: receipt.date,
    status: "Confirmed",
    matchedTransactionId: transactionId,
    userCorrected: true,
  };
  const receipts = state.receipts.some((item) => item.receiptId === receipt.receiptId)
    ? state.receipts.map((item) => (item.receiptId === receipt.receiptId ? { ...item, ...stored } : item))
    : [...state.receipts, stored];
  await writeFake(store, receipt.companyId, { ...state, receipts });
}

function processorResult(receipt: MatchReceipt, transactions: readonly SeedTransaction[]) {
  const matches = candidateMatches(
    {
      id: receipt.receiptId,
      companyId: receipt.companyId,
      merchant: receipt.merchant,
      money: { amountMinor: receipt.amountMinor, currency: receipt.currency },
    },
    transactions,
  );
  const strong = matches.find((match) => match.similarity >= 0.8);
  if (!strong) return { kind: "needs_review" as const };
  return { kind: "confirmed" as const, transactionId: strong.transactionId };
}

async function readFake(store: KeyValueStore, companyId: string): Promise<FakeState> {
  const raw = await store.getItem(fakeKey(companyId));
  if (!raw) return { records: [], receipts: [] };
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return { records: [], receipts: [] };
  const records = "records" in parsed && Array.isArray(parsed.records) ? parsed.records : [];
  const receipts = "receipts" in parsed && Array.isArray(parsed.receipts) ? parsed.receipts : [];
  return { records: records as FakeState["records"], receipts: receipts as FakeReceipt[] };
}

async function writeFake(store: KeyValueStore, companyId: string, state: FakeState): Promise<void> {
  await store.setItem(fakeKey(companyId), JSON.stringify(state));
}

function isTransportFailure(error: unknown): boolean {
  return error instanceof ApiTransportError;
}
