import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../src/domain/errors.ts";
import { fetchCompanyReceipts } from "../mobile/src/receiptList.ts";

const northwind = {
  receiptId: "receipt-1",
  companyId: "northwind",
  merchant: "Blue Bottle",
  amountMinor: 1850,
  currency: "USD",
  date: "10-29-2026",
  status: "Confirmed",
};

describe("company receipt list", () => {
  it("loads this company's receipts with merchant, amount, date, and status", async () => {
    const seen: { url: string; authorization: string }[] = [];
    const receipts = await fetchCompanyReceipts({
      apiUrl: "https://example.test/",
      idToken: "id-token",
      companyId: "northwind",
      fetchImpl: async (url, init) => {
        const headers = init?.headers as Record<string, string>;
        seen.push({ url: String(url), authorization: headers.authorization });
        return new Response(JSON.stringify({ receipts: [northwind] }), { status: 200 });
      },
    });
    assert.equal(seen[0]?.url, "https://example.test/receipts");
    assert.equal(seen[0]?.authorization, "Bearer id-token");
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0]?.merchant, "Blue Bottle");
    assert.equal(receipts[0]?.amountMinor, 1850);
    assert.equal(receipts[0]?.date, "10-29-2026");
    assert.equal(receipts[0]?.status, "Confirmed");
  });

  it("does not show another company's receipts", async () => {
    const receipts = await fetchCompanyReceipts({
      apiUrl: "https://example.test",
      idToken: "id-token",
      companyId: "contoso",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            receipts: [northwind, { ...northwind, receiptId: "receipt-2", companyId: "contoso", merchant: "Contoso Cafe" }],
          }),
          { status: 200 },
        ),
    });
    assert.deepEqual(
      receipts.map((receipt) => receipt.merchant),
      ["Contoso Cafe"],
    );
  });

  it("rejects an unknown status", async () => {
    await assert.rejects(
      () =>
        fetchCompanyReceipts({
          apiUrl: "https://example.test",
          idToken: "id-token",
          companyId: "northwind",
          fetchImpl: async () =>
            new Response(JSON.stringify({ receipts: [{ ...northwind, status: "Posted" }] }), { status: 200 }),
        }),
      DomainError,
    );
  });
});
