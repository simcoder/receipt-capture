import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import type { KeyValueStore } from "../mobile/src/localQueue.ts";
import { applyLateProcessor, confirmReceiptMatch, openMatches } from "../mobile/src/matchReceipt.ts";

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

const parking = {
  receiptId: "receipt-parking",
  companyId: "northwind",
  merchant: "City Parking",
  amountMinor: 2200,
  currency: "USD",
  date: "10-29-2026",
  status: "NeedsReview" as const,
};

describe("match screen", () => {
  it("offers an open transaction and hides it after another receipt takes it", () => {
    const open = openMatches(parking, []);
    assert.deepEqual(
      open.map((choice) => choice.transactionId),
      ["txn-parking"],
    );
    const taken = openMatches(parking, [
      { receiptId: "other-receipt", matchedTransactionId: "txn-parking" },
    ]);
    assert.deepEqual(taken, []);
  });

  it("confirms a NeedsReview receipt and keeps that correction when the processor runs again", async () => {
    const store = memoryStore();
    const confirmed = await confirmReceiptMatch({
      store,
      siblings: [],
      receipt: parking,
      transactionId: "txn-parking",
      idToken: null,
      apiUrl: "",
      offline: true,
    });
    assert.equal(confirmed.status, "Confirmed");
    assert.equal(confirmed.matchedTransactionId, "txn-parking");
    assert.equal(confirmed.userCorrected, true);

    const late = await applyLateProcessor(store, "northwind", parking.receiptId);
    assert.equal(late.status, "Confirmed");
    assert.equal(late.matchedTransactionId, "txn-parking");
    assert.equal(late.userCorrected, true);

    const second = {
      ...parking,
      receiptId: "receipt-lot",
      merchant: "Lot Parking",
    };
    assert.deepEqual(
      openMatches(second, [{ receiptId: parking.receiptId, matchedTransactionId: "txn-parking" }]),
      [],
    );
    await assert.rejects(
      () =>
        confirmReceiptMatch({
          store,
          siblings: [{ receiptId: parking.receiptId, matchedTransactionId: "txn-parking" }],
          receipt: second,
          transactionId: "txn-parking",
          idToken: null,
          apiUrl: "",
          offline: true,
        }),
      DomainError,
    );
  });

  it("sends the chosen transaction to the match API", async () => {
    const seen: { url: string; headers: Record<string, string>; body: string }[] = [];
    const result = await confirmReceiptMatch({
      store: memoryStore(),
      siblings: [],
      receipt: parking,
      transactionId: "txn-parking",
      idToken: "id-token",
      apiUrl: "https://example.test",
      offline: false,
      submitSource: "api",
      fetchImpl: async (url, init) => {
        const headers = init?.headers as Record<string, string>;
        seen.push({ url: String(url), headers, body: String(init?.body) });
        return new Response(
          JSON.stringify({
            receipt: {
              receiptId: parking.receiptId,
              status: "Confirmed",
              matchedTransactionId: "txn-parking",
              userCorrected: true,
            },
          }),
          { status: 200 },
        );
      },
    });
    assert.equal(seen[0]?.url, "https://example.test/receipts/receipt-parking/match");
    assert.equal(seen[0]?.headers.authorization, "Bearer id-token");
    assert.deepEqual(JSON.parse(seen[0]?.body ?? "{}"), { transactionId: "txn-parking" });
    assert.equal(result.status, "Confirmed");
    assert.equal(result.userCorrected, true);
  });

  it("does not confirm locally when the API rejects the transaction", async () => {
    const store = memoryStore();
    await assert.rejects(
      () =>
        confirmReceiptMatch({
          store,
          siblings: [],
          receipt: parking,
          transactionId: "txn-parking",
          idToken: "id-token",
          apiUrl: "https://example.test",
          offline: false,
          submitSource: "api",
          fetchImpl: async () =>
            new Response(JSON.stringify({ error: "transaction is not an open match" }), { status: 409 }),
        }),
      /transaction is not an open match/,
    );
    assert.equal(await store.getItem("receipt-capture.fake.northwind"), null);
  });
});
