import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyProcessorResult,
  candidateMatches,
  fakeProcessor,
  isFailUpload,
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
    const confirmed = fakeProcessor(coffee, seedTransactions, new Set());
    const review = fakeProcessor(parking, seedTransactions, new Set());
    assert.equal(confirmed.kind, "confirmed");
    assert.equal(confirmed.confidence, 0.8);
    assert.equal(review.kind, "needs_review");
    assert.equal(review.confidence, 1 / 3);
    assert.equal(isFailUpload("Fail Upload"), true);
    assert.equal(isFailUpload("Blue Bottle"), false);
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
      confidence: 1,
    });
    assert.equal(late.matchedTransactionId, "txn-blue-bottle");
  });

  it("confirms Harbor Grill on its own seed after Blue Bottle is taken", () => {
    const harbor = {
      id: "rcpt-harbor",
      companyId: "northwind",
      merchant: "Harbor Grill",
      money: { amountMinor: 2400, currency: "USD" },
    };
    const confirmed = fakeProcessor(harbor, seedTransactions, new Set(["txn-blue-bottle"]));
    assert.equal(confirmed.kind, "confirmed");
    assert.equal(confirmed.transactionId, "txn-harbor");
    assert.equal(confirmed.confidence, 0.8);
    const coffee = {
      id: "rcpt-coffee",
      companyId: "northwind",
      merchant: "Blue Bottle Coffee",
      money: { amountMinor: 1850, currency: "USD" },
    };
    const taken = fakeProcessor(coffee, seedTransactions, new Set(["txn-blue-bottle"]));
    assert.equal(taken.kind, "needs_review");
    assert.equal(taken.confidence, 0);
  });
});
