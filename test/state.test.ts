import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import { acceptIntoQueue, transition } from "../src/domain/receiptState.ts";

describe("receipt state", () => {
  it("treats queue acceptance as Queued, not Confirmed", () => {
    assert.equal(acceptIntoQueue(), "Queued");
    assert.notEqual(acceptIntoQueue(), "Confirmed");
  });

  it("reaches Confirmed only from a server accept or a user correction", () => {
    assert.equal(transition("Processing", "serverConfirm"), "Confirmed");
    assert.equal(transition("NeedsReview", "userConfirm"), "Confirmed");
    assert.throws(() => transition("Draft", "serverConfirm"), DomainError);
    assert.throws(() => transition("Queued", "serverConfirm"), DomainError);
    assert.throws(() => transition("Uploading", "serverConfirm"), DomainError);
  });

  it("walks the happy path and the failure retry", () => {
    let status = acceptIntoQueue();
    status = transition(status, "startUpload");
    status = transition(status, "acceptUpload");
    assert.equal(status, "Processing");
    assert.equal(transition("Uploading", "fail"), "Failed");
    assert.equal(transition("Failed", "retry"), "Queued");
  });
});
