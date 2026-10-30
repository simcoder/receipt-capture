import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import { moneyFromDecimal } from "../src/domain/money.ts";
import { captureDraft } from "../mobile/src/receipts/receiptDraft.ts";
import { dateFromStored, formatDateOnly, maskAmount } from "../mobile/src/receipts/captureFields.ts";

describe("capture fields", () => {
  it("keeps two decimals and drops a third", () => {
    assert.equal(maskAmount("12.34"), "12.34");
    assert.equal(maskAmount("12.344"), "12.34");
    assert.equal(maskAmount("12.3.4"), "12.34");
    assert.equal(maskAmount("12."), "12.");
    assert.equal(maskAmount("usd 12"), "12");
  });

  it("stores a picked date as MM-DD-YYYY and still uses moneyFromDecimal", () => {
    const picked = new Date(2026, 9, 29);
    const stored = formatDateOnly(picked);
    assert.equal(stored, "10-29-2026");
    assert.equal(dateFromStored(stored, new Date(2020, 0, 1)).getDate(), 29);
    const draft = captureDraft({
      localId: "local-1",
      companyId: "northwind",
      merchant: "Blue Bottle",
      amount: maskAmount("12.344"),
      currency: "USD",
      date: stored,
      imageId: "cafe-receipt",
    });
    assert.equal(draft.date, "10-29-2026");
    assert.equal(draft.amountMinor, 1234);
    assert.throws(() => moneyFromDecimal("12.344", "USD"), DomainError);
  });
});
