import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDeviceOnline } from "../mobile/src/providers/connectivity.ts";

describe("connectivity banner", () => {
  it("is online when the device has a network", () => {
    assert.equal(isDeviceOnline({ isConnected: true }), true);
    assert.equal(isDeviceOnline(null), true);
  });

  it("is offline only when the device reports no network", () => {
    assert.equal(isDeviceOnline({ isConnected: false }), false);
  });
});
