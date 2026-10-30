import { candidateMatches } from "../../../src/domain/matching.ts";
import type { PortalReceipt, PortalTransaction } from "./receipts.ts";

/** Open matches for one receipt. A transaction already taken by another receipt is hidden. */
export function openMatchChoices(
  receipt: PortalReceipt,
  transactions: readonly PortalTransaction[],
  siblings: readonly PortalReceipt[],
) {
  const taken = new Map<string, string>();
  for (const row of siblings) {
    if (row.receiptId === receipt.receiptId || !row.matchedTransactionId) continue;
    taken.set(row.matchedTransactionId, row.receiptId);
  }
  const stamped = transactions.map((transaction) => {
    const matchedReceiptId = taken.get(transaction.id);
    return matchedReceiptId ? { ...transaction, matchedReceiptId } : transaction;
  });
  return candidateMatches(
    {
      id: receipt.receiptId,
      companyId: receipt.companyId,
      merchant: receipt.merchant,
      money: { amountMinor: receipt.amountMinor, currency: receipt.currency },
    },
    stamped,
  );
}
