import { DomainError } from "./errors.ts";
import { sameMoney, type Money } from "./money.ts";

export type SeedTransaction = {
  id: string;
  companyId: string;
  merchant: string;
  money: Money;
  matchedReceiptId?: string;
};

export type MatchCandidate = {
  transactionId: string;
  similarity: number;
};

export type ReceiptForMatch = {
  id: string;
  companyId: string;
  merchant: string;
  money: Money;
};

export type ProcessorResult =
  | { kind: "confirmed"; transactionId: string }
  | { kind: "needs_review" };

export type ReviewState = {
  status: "Processing" | "NeedsReview" | "Confirmed";
  userCorrected: boolean;
  matchedTransactionId?: string;
};

export function normalizeMerchant(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Token overlap after normalization. 1 when the normalized names are equal. */
export function merchantSimilarity(left: string, right: string): number {
  const a = normalizeMerchant(left);
  const b = normalizeMerchant(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;

  const leftTokens = new Set(a.split(" ").filter(Boolean));
  const rightTokens = new Set(b.split(" ").filter(Boolean));
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  const union = leftTokens.size + rightTokens.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * Candidates must share company, currency, and minor units, and have some merchant overlap.
 * A transaction already matched to a different receipt is not a candidate.
 */
export function candidateMatches(
  receipt: ReceiptForMatch,
  transactions: readonly SeedTransaction[],
): MatchCandidate[] {
  return transactions
    .filter((transaction) => transaction.companyId === receipt.companyId)
    .filter((transaction) => sameMoney(transaction.money, receipt.money))
    .filter(
      (transaction) =>
        !transaction.matchedReceiptId || transaction.matchedReceiptId === receipt.id,
    )
    .map((transaction) => ({
      transactionId: transaction.id,
      similarity: merchantSimilarity(receipt.merchant, transaction.merchant),
    }))
    .filter((candidate) => candidate.similarity > 0)
    .sort((left, right) => {
      if (right.similarity !== left.similarity) return right.similarity - left.similarity;
      return left.transactionId.localeCompare(right.transactionId);
    });
}

export function confirmMatch(
  receipt: ReceiptForMatch,
  transactionId: string,
  transactions: readonly SeedTransaction[],
): SeedTransaction[] {
  const target = transactions.find((transaction) => transaction.id === transactionId);
  if (target?.matchedReceiptId && target.matchedReceiptId !== receipt.id) {
    throw new DomainError(`transaction ${transactionId} is already matched`);
  }

  const allowed = candidateMatches(receipt, transactions).some(
    (candidate) => candidate.transactionId === transactionId,
  );
  if (!allowed) {
    throw new DomainError(`transaction ${transactionId} is not a match for receipt ${receipt.id}`);
  }

  return transactions.map((transaction) => {
    if (transaction.id !== transactionId) return transaction;
    if (transaction.matchedReceiptId && transaction.matchedReceiptId !== receipt.id) {
      throw new DomainError(`transaction ${transactionId} is already matched`);
    }
    return { ...transaction, matchedReceiptId: receipt.id };
  });
}

export function applyProcessorResult(state: ReviewState, result: ProcessorResult): ReviewState {
  if (state.userCorrected || state.status === "Confirmed") return state;
  if (result.kind === "needs_review") {
    return { ...state, status: "NeedsReview" };
  }
  return {
    ...state,
    status: "Confirmed",
    matchedTransactionId: result.transactionId,
  };
}

export function applyUserCorrection(state: ReviewState, transactionId: string): ReviewState {
  return {
    status: "Confirmed",
    userCorrected: true,
    matchedTransactionId: transactionId,
  };
}
