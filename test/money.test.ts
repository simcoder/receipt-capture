import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import { parseDateOnly } from "../src/domain/dateOnly.ts";
import { moneyFromDecimal, sameMoney } from "../src/domain/money.ts";

describe("money", () => {
  it("stores a decimal string as integer minor units", () => {
    assert.deepEqual(moneyFromDecimal("12.34", "usd"), { amountMinor: 1234, currency: "USD" });
    assert.deepEqual(moneyFromDecimal("12.3", "USD"), { amountMinor: 1230, currency: "USD" });
    assert.deepEqual(moneyFromDecimal("12", "USD"), { amountMinor: 1200, currency: "USD" });
  });

  it("rejects floats, extra precision, and bad currency", () => {
    assert.throws(() => moneyFromDecimal("12.345", "USD"), DomainError);
    assert.throws(() => moneyFromDecimal("12.34", "US"), DomainError);
    assert.throws(() => moneyFromDecimal("-1.00", "USD"), DomainError);
    assert.throws(() => moneyFromDecimal("1e2", "USD"), DomainError);
  });

  it("compares currency and minor units together", () => {
    const usd = moneyFromDecimal("10.00", "USD");
    const eur = moneyFromDecimal("10.00", "EUR");
    assert.equal(sameMoney(usd, moneyFromDecimal("10", "USD")), true);
    assert.equal(sameMoney(usd, eur), false);
  });
});

describe("date only", () => {
  it("accepts a calendar date and rejects a timestamp", () => {
    assert.equal(parseDateOnly("10-29-2026"), "10-29-2026");
    assert.throws(() => parseDateOnly("2026-10-29"), DomainError);
    assert.throws(() => parseDateOnly("10-29-2026T00:00:00Z"), DomainError);
    assert.throws(() => parseDateOnly("02-31-2026"), DomainError);
  });
});
