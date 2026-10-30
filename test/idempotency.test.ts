import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import { assertCanUpload, clearQueueOnLogout } from "../src/domain/company.ts";
import { resolveSubmit } from "../src/domain/idempotency.ts";

describe("idempotency", () => {
  it("returns the original receipt when the success response was lost", () => {
    const first = resolveSubmit([], {
      key: "submit-1",
      companyId: "northwind",
      receiptId: "rcpt-1",
    });
    const retry = resolveSubmit(first.records, {
      key: "submit-1",
      companyId: "northwind",
      receiptId: "rcpt-should-not-be-created",
    });

    assert.equal(first.replayed, false);
    assert.equal(retry.replayed, true);
    assert.equal(retry.receiptId, "rcpt-1");
    assert.equal(retry.records.length, 1);
  });

  it("does not let another company replay the key", () => {
    const first = resolveSubmit([], {
      key: "submit-1",
      companyId: "northwind",
      receiptId: "rcpt-1",
    });
    assert.throws(
      () =>
        resolveSubmit(first.records, {
          key: "submit-1",
          companyId: "contoso",
          receiptId: "rcpt-2",
        }),
      DomainError,
    );
  });
});

describe("company switch", () => {
  it("blocks upload of another company's queued receipt", () => {
    assert.throws(
      () => assertCanUpload("contoso", { localId: "local-1", companyId: "northwind" }),
      DomainError,
    );
    assert.doesNotThrow(() =>
      assertCanUpload("northwind", { localId: "local-1", companyId: "northwind" }),
    );
  });

  it("clears the local queue on logout", () => {
    assert.deepEqual(clearQueueOnLogout(), []);
  });
});
