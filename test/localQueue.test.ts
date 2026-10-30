import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import { captureDraft, queueDraft, type CaptureInput } from "../mobile/src/receipts/receiptDraft.ts";
import {
  clearCompanyQueue,
  loadLocalSession,
  OFFLINE_KEY,
  queueKey,
  saveOffline,
  saveQueue,
  serializeQueue,
  type KeyValueStore,
} from "../mobile/src/storage/localQueue.ts";

function memoryStore(): KeyValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
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

function draft(overrides: Partial<CaptureInput> = {}) {
  return captureDraft({
    localId: "local-1",
    companyId: "northwind",
    merchant: "Northwind Cafe",
    amount: "12.34",
    currency: "usd",
    date: "10-29-2026",
    imageId: "cafe-receipt",
    ...overrides,
  });
}

describe("offline queue", () => {
  it("keeps the same queue and offline flag after relaunch", async () => {
    const store = memoryStore();
    const queued = queueDraft(draft());
    await saveQueue(store, "northwind", [queued]);
    await saveOffline(store, true);

    const reloaded = await loadLocalSession(store, "northwind");
    assert.equal(reloaded.offline, true);
    assert.deepEqual(reloaded.receipts, [queued]);
    assert.equal(reloaded.receipts[0]?.status, "Queued");
    assert.equal(reloaded.receipts[0]?.amountMinor, 1234);
    assert.equal(reloaded.receipts[0]?.imageId, "cafe-receipt");
  });

  it("stores metadata only, not tokens or image bytes", () => {
    const dirty = {
      ...draft(),
      idToken: "secret-token",
      accessToken: "access",
      refreshToken: "refresh",
      imageBytes: "raw-bytes",
      imageBase64: "aaaa",
    };
    const json = serializeQueue([dirty]);
    assert.equal(json.includes("secret-token"), false);
    assert.equal(json.includes("access"), false);
    assert.equal(json.includes("refresh"), false);
    assert.equal(json.includes("raw-bytes"), false);
    assert.equal(json.includes("aaaa"), false);
    assert.equal(json.includes("idToken"), false);
    assert.equal(json.includes("imageBytes"), false);
    assert.match(json, /cafe-receipt/);
  });

  it("does not let another company read the queue", async () => {
    const store = memoryStore();
    await saveQueue(store, "northwind", [draft()]);
    const contoso = await loadLocalSession(store, "contoso");
    assert.deepEqual(contoso.receipts, []);
    assert.notEqual(queueKey("northwind"), queueKey("contoso"));
  });

  it("clears that company's queue on logout and leaves the offline flag", async () => {
    const store = memoryStore();
    await saveQueue(store, "northwind", [draft()]);
    await saveQueue(store, "contoso", [draft({ companyId: "contoso", localId: "local-2" })]);
    await saveOffline(store, true);

    await clearCompanyQueue(store, "northwind");

    const northwind = await loadLocalSession(store, "northwind");
    const contoso = await loadLocalSession(store, "contoso");
    assert.deepEqual(northwind.receipts, []);
    assert.equal(northwind.offline, true);
    assert.equal(contoso.receipts.length, 1);
    assert.equal(store.values.has(OFFLINE_KEY), true);
  });

  it("keeps a photo visit as an image id and does not store the bytes", async () => {
    const store = memoryStore();
    const photo = draft({ imageId: "device-photo" });
    await saveQueue(store, "northwind", [photo]);
    const raw = store.values.get(queueKey("northwind")) ?? "";
    assert.equal(raw.includes("imageBase64"), false);
    assert.equal(raw.includes("device-photo"), true);
    const reloaded = await loadLocalSession(store, "northwind");
    assert.equal(reloaded.receipts[0]?.imageId, "device-photo");
  });

  it("rejects image bytes and tokens if they were written into the queue", async () => {
    const store = memoryStore();
    await store.setItem(
      queueKey("northwind"),
      JSON.stringify([{ ...draft(), imageBase64: "aaaa" }]),
    );
    await assert.rejects(() => loadLocalSession(store, "northwind"), DomainError);

    await store.setItem(
      queueKey("northwind"),
      JSON.stringify([{ ...draft(), idToken: "secret-token" }]),
    );
    await assert.rejects(() => loadLocalSession(store, "northwind"), DomainError);
  });
});
