import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KeyValueStore } from "../mobile/src/storage/localQueue.ts";
import {
  SEED_TRANSACTIONS,
  submitReceipt,
  submitRequest,
} from "../mobile/src/receipts/submitReceipt.ts";

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

const receipt = {
  store: memoryStore(),
  companyId: "northwind",
  merchant: "Blue Bottle Coffee",
  amountMinor: 1850,
  currency: "USD",
  date: "10-29-2026",
  idempotencyKey: "local-1",
  idToken: null as string | null,
  apiUrl: "",
  offline: false,
};

describe("submit receipt", () => {
  it("sends Idempotency-Key and does not send image bytes", async () => {
    const seen: { url: string; headers: Record<string, string>; body: string }[] = [];
    const result = await submitReceipt({
      ...receipt,
      store: memoryStore(),
      idToken: "id-token",
      apiUrl: "https://example.test",
      fetchImpl: async (url, init) => {
        const headers = init?.headers as Record<string, string>;
        seen.push({ url: String(url), headers, body: String(init?.body) });
        return new Response(
          JSON.stringify({
            receipt: {
              receiptId: "server-1",
              status: "NeedsReview",
            },
            replayed: false,
          }),
          { status: 201 },
        );
      },
    });

    assert.equal(seen[0]?.url, "https://example.test/receipts");
    assert.equal(seen[0]?.headers["idempotency-key"], "local-1");
    assert.equal(seen[0]?.headers.authorization, "Bearer id-token");
    assert.equal(seen[0]?.body.includes("imageBase64"), false);
    assert.equal(JSON.parse(seen[0]?.body ?? "{}").amount, "18.50");
    assert.equal(result.receiptId, "server-1");
    assert.equal(result.source, "api");
  });

  it("returns the same receipt when the first success response is lost", async () => {
    const store = new Map<string, { receiptId: string; status: string }>();
    let calls = 0;
    const result = await submitReceipt({
      ...receipt,
      store: memoryStore(),
      idToken: "access-token",
      apiUrl: "https://example.test",
      fetchImpl: async (_url, init) => {
        calls += 1;
        const key = (init?.headers as Record<string, string>)["idempotency-key"];
        const existing = store.get(key);
        if (existing) {
          return new Response(JSON.stringify({ receipt: existing, replayed: true }), { status: 200 });
        }
        const created = { receiptId: "server-1", status: "Confirmed" };
        store.set(key, created);
        throw new Error("socket hang up");
      },
    });

    assert.equal(calls, 2);
    assert.equal(result.receiptId, "server-1");
    assert.equal(result.replayed, true);
    assert.equal(result.status, "Confirmed");
    assert.equal(result.source, "api");
  });

  it("uses the local fake when AWS cannot be reached, and a retry returns that receipt", async () => {
    const store = memoryStore();
    const input = {
      ...receipt,
      store,
      idToken: "access-token",
      apiUrl: "https://example.test",
      fetchImpl: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    };
    const first = await submitReceipt(input);
    const second = await submitReceipt(input);
    assert.equal(first.source, "local-fake");
    assert.equal(first.replayed, false);
    assert.equal(second.receiptId, first.receiptId);
    assert.equal(second.replayed, true);
    assert.equal(second.status, first.status);
    assert.equal(first.status, "Confirmed");
  });

  it("runs with no API url, which is the expo start path when AWS is down", async () => {
    const store = memoryStore();
    let called = false;
    const result = await submitReceipt({
      ...receipt,
      store,
      merchant: "City Parking",
      amountMinor: 400,
      fetchImpl: async () => {
        called = true;
        throw new Error("should not be called");
      },
    });
    assert.equal(called, false);
    assert.equal(result.source, "local-fake");
    assert.equal(result.status, "NeedsReview");
    assert.deepEqual(
      SEED_TRANSACTIONS.map((transaction) => transaction.id),
      ["txn-blue-bottle", "txn-parking", "txn-contoso-cafe"],
    );
  });

  it("surfaces an unauthorized response and does not store a local fake", async () => {
    const store = memoryStore();
    await assert.rejects(
      () =>
        submitReceipt({
          ...receipt,
          store,
          idToken: "id-token",
          apiUrl: "https://example.test",
          fetchImpl: async () => new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }),
        }),
      /Unauthorized/,
    );
    assert.equal(await store.getItem("receipt-capture.fake.northwind"), null);
  });

  it("sends a photo only when online and under the quarantine limit", async () => {
    const seen: string[] = [];
    await submitReceipt({
      ...receipt,
      store: memoryStore(),
      idToken: "id-token",
      apiUrl: "https://example.test",
      imageBase64: "data:image/jpeg;base64,YQ==",
      fetchImpl: async (_url, init) => {
        seen.push(String(init?.body));
        return new Response(JSON.stringify({ receipt: { receiptId: "server-1", status: "NeedsReview" } }), {
          status: 201,
        });
      },
    });
    assert.equal(JSON.parse(seen[0] ?? "{}").imageBase64, "YQ==");

    const offlineStore = memoryStore();
    let called = false;
    await submitReceipt({
      ...receipt,
      store: offlineStore,
      offline: true,
      imageBase64: "YQ==",
      fetchImpl: async () => {
        called = true;
        return new Response("{}", { status: 500 });
      },
    });
    assert.equal(called, false);
    assert.equal(String(await offlineStore.getItem("receipt-capture.fake.northwind")).includes("imageBase64"), false);

    const oversized = "A".repeat(666668);
    const largeSeen: string[] = [];
    await submitReceipt({
      ...receipt,
      store: memoryStore(),
      idToken: "id-token",
      apiUrl: "https://example.test",
      imageBase64: oversized,
      fetchImpl: async (_url, init) => {
        largeSeen.push(String(init?.body));
        return new Response(JSON.stringify({ receipt: { receiptId: "server-2", status: "NeedsReview" } }), {
          status: 201,
        });
      },
    });
    assert.equal(largeSeen[0]?.includes("imageBase64"), false);
  });

  it("builds the request without a token in the body", () => {
    const request = submitRequest({
      apiUrl: "https://example.test/",
      idToken: "access-token",
      idempotencyKey: "local-1",
      merchant: "Northwind Cafe",
      amountMinor: 1234,
      currency: "USD",
      date: "10-29-2026",
    });
    assert.equal(request.url, "https://example.test/receipts");
    assert.equal(String(request.init.body).includes("access-token"), false);
  });
});
