import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import { moneyFromDecimal } from "../src/domain/money.ts";
import {
  applyProcessorResult,
  applyUserCorrection,
  candidateMatches,
  confirmMatch,
  type ReceiptForMatch,
  type SeedTransaction,
} from "../src/domain/matching.ts";

const usd = (amount: string) => moneyFromDecimal(amount, "USD");

const receipt: ReceiptForMatch = {
  id: "rcpt-1",
  companyId: "northwind",
  merchant: "Blue Bottle Coffee",
  money: usd("18.50"),
};

const transactions: SeedTransaction[] = [
  {
    id: "txn-close",
    companyId: "northwind",
    merchant: "Blue Bottle",
    money: usd("18.50"),
  },
  {
    id: "txn-other-amount",
    companyId: "northwind",
    merchant: "Blue Bottle Coffee",
    money: usd("18.51"),
  },
  {
    id: "txn-other-company",
    companyId: "contoso",
    merchant: "Blue Bottle Coffee",
    money: usd("18.50"),
  },
  {
    id: "txn-unrelated",
    companyId: "northwind",
    merchant: "Airport Parking",
    money: usd("18.50"),
  },
];

describe("matching", () => {
  it("requires the same currency and minor units, then ranks merchant similarity", () => {
    const matches = candidateMatches(receipt, transactions);
    assert.deepEqual(
      matches.map((match) => match.transactionId),
      ["txn-close"],
    );
  });

  it("rejects a second receipt on a transaction that is already matched", () => {
    const matched = confirmMatch(receipt, "txn-close", transactions);
    const other: ReceiptForMatch = { ...receipt, id: "rcpt-2" };
    assert.throws(() => confirmMatch(other, "txn-close", matched), DomainError);
  });

  it("keeps a user correction when a late processor result arrives", () => {
    const corrected = applyUserCorrection(
      { status: "NeedsReview", userCorrected: false },
      "txn-close",
    );
    const late = applyProcessorResult(corrected, {
      kind: "confirmed",
      transactionId: "txn-other-amount",
    });
    assert.equal(late.matchedTransactionId, "txn-close");
    assert.equal(late.status, "Confirmed");
    assert.equal(late.userCorrected, true);
  });

  it("lets the processor send NeedsReview before the user corrects it", () => {
    const reviewed = applyProcessorResult(
      { status: "Processing", userCorrected: false },
      { kind: "needs_review" },
    );
    assert.equal(reviewed.status, "NeedsReview");
    assert.equal(reviewed.userCorrected, false);
  });
});
