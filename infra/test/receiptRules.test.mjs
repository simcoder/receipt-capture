import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyProcessorResult,
  candidateMatches,
  fakeProcessor,
  moneyFromDecimal,
  parseDateOnly,
  seedTransactions,
} from "../lambda/receiptRules.mjs";

describe("infra receipt rules", () => {
  it("parses money and dates the same way as the app domain", () => {
    assert.deepEqual(moneyFromDecimal("18.50", "usd"), { amountMinor: 1850, currency: "USD" });
    assert.equal(parseDateOnly("10-29-2026"), "10-29-2026");
    assert.throws(() => moneyFromDecimal("18.501", "USD"));
    assert.throws(() => parseDateOnly("2026-10-29"));
    assert.throws(() => parseDateOnly("2026-10-29T00:00:00Z"));
  });

  it("confirms a close merchant and sends an unrelated one to review", () => {
    const coffee = {
      id: "rcpt-1",
      companyId: "northwind",
      merchant: "Blue Bottle Coffee",
      money: { amountMinor: 1850, currency: "USD" },
    };
    const parking = {
      ...coffee,
      id: "rcpt-2",
      merchant: "City Parking",
      money: { amountMinor: 2200, currency: "USD" },
    };
    assert.equal(fakeProcessor(coffee, seedTransactions, new Set()).kind, "confirmed");
    assert.equal(fakeProcessor(parking, seedTransactions, new Set()).kind, "needs_review");
    assert.deepEqual(
      candidateMatches(coffee, seedTransactions, new Set()).map((match) => match.transactionId),
      ["txn-blue-bottle"],
    );
  });

  it("does not let a late processor result replace a user correction", () => {
    const corrected = {
      status: "Confirmed",
      userCorrected: true,
      matchedTransactionId: "txn-blue-bottle",
    };
    const late = applyProcessorResult(corrected, {
      kind: "confirmed",
      transactionId: "txn-parking",
    });
    assert.equal(late.matchedTransactionId, "txn-blue-bottle");
  });
});
