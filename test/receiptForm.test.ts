import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import { moneyFromDecimal } from "../src/domain/money.ts";
import { parseDateOnly } from "../src/domain/dateOnly.ts";
import { acceptIntoQueue, RECEIPT_STATUSES as DOMAIN_STATUSES } from "../src/domain/receiptState.ts";
import {
  captureDraft,
  captureActionLabel,
  formatMoney,
  queueDraft,
  receiptsWaitingToSubmit,
  RECEIPT_STATUSES,
  type CaptureInput,
} from "../mobile/src/receipts/receiptDraft.ts";
import * as receiptDraft from "../mobile/src/receipts/receiptDraft.ts";

function valid(overrides: Partial<CaptureInput> = {}): CaptureInput {
  return {
    localId: "local-1",
    companyId: "northwind",
    merchant: "Northwind Cafe",
    amount: "12.34",
    currency: "usd",
    date: "10-29-2026",
    imageId: "cafe-receipt",
    ...overrides,
  };
}

describe("receipt form", () => {
  it("saves a draft with minor units, an MM-DD-YYYY date, and a synthetic image", () => {
    const draft = captureDraft(valid());
    const money = moneyFromDecimal("12.34", "usd");
    assert.equal(draft.status, "Draft");
    assert.equal(draft.merchant, "Northwind Cafe");
    assert.equal(draft.companyId, "northwind");
    assert.equal(draft.amountMinor, money.amountMinor);
    assert.equal(draft.currency, money.currency);
    assert.equal(draft.date, parseDateOnly("10-29-2026"));
    assert.equal(draft.imageId, "cafe-receipt");
    assert.equal(draft.notes, undefined);
    assert.equal(formatMoney(draft.amountMinor, draft.currency), "12.34 USD");
  });

  it("keeps optional notes and still saves when notes are empty", () => {
    assert.equal(captureDraft(valid({ notes: "  gate code  " })).notes, "gate code");
    assert.equal(captureDraft(valid({ notes: "   " })).notes, undefined);
    assert.equal(captureDraft(valid()).status, "Draft");
  });

  it("submits while online and queues while offline", () => {
    assert.equal(captureActionLabel({ signedIn: true, online: true }), "Submit");
    assert.equal(captureActionLabel({ signedIn: true, online: false }), "Queue receipt");
    assert.equal(captureActionLabel({ signedIn: false, online: true }), "Save draft");
    const queued = queueDraft(captureDraft(valid()));
    assert.deepEqual(
      receiptsWaitingToSubmit([queued, { ...queued, localId: "done", receiptId: "server-1", status: "NeedsReview" }]).map(
        (receipt) => receipt.localId,
      ),
      ["local-1"],
    );
  });

  it("rejects a missing merchant, a bad amount, a bad date, and a missing image", () => {
    assert.throws(() => captureDraft(valid({ merchant: "  " })), DomainError);
    assert.throws(() => captureDraft(valid({ amount: "12.345" })), DomainError);
    assert.throws(() => captureDraft(valid({ date: "2026-10-29" })), DomainError);
    assert.throws(() => captureDraft(valid({ imageId: "" })), /pick a synthetic image/);
    assert.throws(() => captureDraft(valid({ companyId: "" })), DomainError);
  });

  it("shows every receipt state and queues a draft without marking Confirmed", () => {
    assert.deepEqual([...RECEIPT_STATUSES], [...DOMAIN_STATUSES]);
    assert.deepEqual(
      [...RECEIPT_STATUSES],
      ["Draft", "Queued", "Uploading", "Processing", "Failed", "NeedsReview", "Confirmed"],
    );
    const queued = queueDraft(captureDraft(valid()));
    assert.equal(queued.status, "Queued");
    assert.equal(queued.status, acceptIntoQueue());
    assert.notEqual(queued.status, "Confirmed");
    assert.throws(() => queueDraft(queued), DomainError);
    const names = Object.keys(receiptDraft).map((name) => name.toLowerCase());
    assert.equal(
      names.some((name) => name.includes("confirm")),
      false,
    );
  });
});
