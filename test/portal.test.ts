import assert from "node:assert/strict";
import test from "node:test";
import { companyIdFromIdToken } from "../portal/src/auth/cognito.ts";
import { parsePortalConfig } from "../portal/src/config.ts";
import { openMatchChoices } from "../portal/src/receipts/choices.ts";
import {
  formatConfidence,
  formatMoney,
  parseReceipt,
  type PortalReceipt,
  type PortalTransaction,
} from "../portal/src/receipts/receipts.ts";

function token(claims: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `header.${body}.sig`;
}

const receipt = (overrides: Partial<PortalReceipt> = {}): PortalReceipt => ({
  receiptId: "r1",
  companyId: "northwind",
  merchant: "City Parking",
  amountMinor: 2200,
  currency: "USD",
  date: "10-15-2026",
  status: "NeedsReview",
  matchedTransactionId: null,
  userCorrected: false,
  objectKey: null,
  ...overrides,
});

test("parsePortalConfig requires the four site values", () => {
  assert.throws(() => parsePortalConfig({}), /region is required/);
  const config = parsePortalConfig({
    region: " us-east-1 ",
    userPoolId: "pool",
    userPoolClientId: "client",
    apiUrl: "https://example.test/",
  });
  assert.equal(config.region, "us-east-1");
  assert.equal(config.apiUrl, "https://example.test");
});

test("company id comes from the ID token claim", () => {
  assert.equal(companyIdFromIdToken(token({ "custom:company_id": "northwind" })), "northwind");
  assert.equal(companyIdFromIdToken(token({})), null);
});

test("a receipt keeps a numeric confidence and drops null", () => {
  const scored = parseReceipt({
    receiptId: "r1",
    companyId: "northwind",
    merchant: "Blue Bottle",
    amountMinor: 1850,
    currency: "USD",
    date: "10-15-2026",
    status: "Confirmed",
    matchedTransactionId: "txn-blue-bottle",
    userCorrected: false,
    confidence: 0.8,
    objectKey: "quarantine/northwind/r1",
  });
  assert.equal(scored.confidence, 0.8);
  assert.equal(formatConfidence(0.8), "0.80 (80%)");
  assert.equal(formatMoney(1850, "USD"), "18.50 USD");
  const unscored = parseReceipt({ ...scored, confidence: null, objectKey: null });
  assert.equal(unscored.confidence, undefined);
  assert.equal(unscored.objectKey, null);
  assert.throws(() => parseReceipt({ ...scored, confidence: 1.2 }), /confidence/);
});

test("an open match hides a transaction another receipt already took", () => {
  const transactions: PortalTransaction[] = [
    { id: "txn-parking", companyId: "northwind", merchant: "Airport Parking", money: { amountMinor: 2200, currency: "USD" } },
    { id: "txn-blue-bottle", companyId: "northwind", merchant: "Blue Bottle", money: { amountMinor: 1850, currency: "USD" } },
  ];
  const current = receipt();
  const taken = receipt({
    receiptId: "r2",
    merchant: "Blue Bottle",
    amountMinor: 1850,
    status: "Confirmed",
    matchedTransactionId: "txn-blue-bottle",
  });
  const choices = openMatchChoices(current, transactions, [current, taken]);
  assert.deepEqual(choices.map((choice) => choice.transactionId), ["txn-parking"]);
});
