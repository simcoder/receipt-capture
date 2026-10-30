import { DomainError } from "./errors.ts";

/** ISO currency with two decimal places. Stored as an integer number of minor units. */
export type Money = {
  amountMinor: number;
  currency: string;
};

const CURRENCY = /^[A-Z]{3}$/;

/**
 * Parse a decimal amount string into minor units.
 * "12.34" and currency "usd" become { amountMinor: 1234, currency: "USD" }.
 * Binary floats are not accepted. More than two decimal places is rejected.
 */
export function moneyFromDecimal(amount: string, currency: string): Money {
  const code = currency.trim().toUpperCase();
  if (!CURRENCY.test(code)) {
    throw new DomainError(`invalid currency: ${currency}`);
  }

  const trimmed = amount.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new DomainError(`invalid amount: ${amount}`);
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) {
    throw new DomainError(`amount is out of range: ${amount}`);
  }

  return { amountMinor: minor, currency: code };
}

export function sameMoney(left: Money, right: Money): boolean {
  return left.amountMinor === right.amountMinor && left.currency === right.currency;
}
