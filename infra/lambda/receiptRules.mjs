/**
 * API-side copy of the domain rules in src/domain.
 * Kept inside infra/ so this folder can be deployed and destroyed on its own.
 */

export function moneyFromDecimal(amount, currency) {
  const code = String(currency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error(`invalid currency: ${currency}`);
  }
  const trimmed = String(amount ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`invalid amount: ${amount}`);
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`amount is out of range: ${amount}`);
  }
  return { amountMinor: minor, currency: code };
}

export function parseDateOnly(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value ?? "").trim());
  if (!match) throw new Error(`date must be MM-DD-YYYY: ${value}`);
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const valid =
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
  if (!valid) throw new Error(`date is not a real calendar day: ${value}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export const FAIL_UPLOAD_MERCHANT = "Fail Upload";

export function isFailUpload(merchant) {
  return normalizeMerchant(merchant) === normalizeMerchant(FAIL_UPLOAD_MERCHANT);
}

export function normalizeMerchant(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function merchantSimilarity(left, right) {
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

export const seedTransactions = [
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

export function candidateMatches(receipt, transactions, takenTransactionIds) {
  return transactions
    .filter((transaction) => transaction.companyId === receipt.companyId)
    .filter(
      (transaction) =>
        transaction.money.amountMinor === receipt.money.amountMinor &&
        transaction.money.currency === receipt.money.currency,
    )
    .filter((transaction) => !takenTransactionIds.has(transaction.id))
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

export function fakeProcessor(receipt, transactions, takenTransactionIds) {
  const matches = candidateMatches(receipt, transactions, takenTransactionIds);
  const confidence = matches[0]?.similarity ?? 0;
  const strong = matches.find((match) => match.similarity >= 0.8);
  if (!strong) return { kind: "needs_review", confidence };
  return { kind: "confirmed", transactionId: strong.transactionId, confidence: strong.similarity };
}

export function applyProcessorResult(state, result) {
  if (state.userCorrected || state.status === "Confirmed") return state;
  if (result.kind === "needs_review") return { ...state, status: "NeedsReview", confidence: result.confidence };
  return {
    ...state,
    status: "Confirmed",
    matchedTransactionId: result.transactionId,
    confidence: result.confidence,
  };
}
