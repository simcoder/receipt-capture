import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { showFakeReceipts } from "../mobile/src/receipts/showFakeReceipts.ts";

describe("showFakeReceipts", () => {
  it("stays hidden unless the env value is 1", () => {
    assert.equal(showFakeReceipts(undefined), false);
    assert.equal(showFakeReceipts(""), false);
    assert.equal(showFakeReceipts("0"), false);
    assert.equal(showFakeReceipts("true"), false);
    assert.equal(showFakeReceipts("1"), true);
  });
});
