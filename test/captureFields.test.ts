import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import { moneyFromDecimal } from "../src/domain/money.ts";
import { captureDraft } from "../mobile/src/receipts/receiptDraft.ts";
import { dateFromStored, formatAmount, formatDateOnly, maskAmount } from "../mobile/src/receipts/captureFields.ts";

describe("capture fields", () => {
  it("keeps two decimals and drops a third", () => {
    assert.equal(maskAmount("12.34"), "12.34");
    assert.equal(maskAmount("12.344"), "12.34");
    assert.equal(maskAmount("12.3.4"), "12.34");
    assert.equal(maskAmount("12."), "12.");
    assert.equal(maskAmount("usd 12"), "12");
  });

  it("fills two decimal places and keeps a whole number in dollars", () => {
    assert.equal(formatAmount("18"), "18.00");
    assert.equal(formatAmount("1320"), "1320.00");
    assert.equal(formatAmount("12.3"), "12.30");
    assert.equal(formatAmount("12.34"), "12.34");
    assert.equal(formatAmount("12."), "12.00");
    assert.equal(formatAmount(".5"), "0.50");
    assert.equal(formatAmount(""), "");
    assert.equal(moneyFromDecimal(formatAmount("18"), "USD").amountMinor, 1800);
    assert.equal(moneyFromDecimal(formatAmount("1320"), "USD").amountMinor, 132000);
    assert.equal(moneyFromDecimal(formatAmount("12.3"), "USD").amountMinor, 1230);
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
