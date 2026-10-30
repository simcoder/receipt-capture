import { parseDateOnly } from "../../src/domain/dateOnly.ts";
import { DomainError } from "../../src/domain/errors.ts";
import { RECEIPT_STATUSES, type ReceiptStatus } from "../../src/domain/receiptState.ts";

const STATUSES = new Set<string>(RECEIPT_STATUSES);

export type CompanyReceipt = {
  receiptId: string;
  companyId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
  status: ReceiptStatus;
};

export async function fetchCompanyReceipts(input: {
  apiUrl: string;
  idToken: string;
  companyId: string;
  fetchImpl?: typeof fetch;
}): Promise<CompanyReceipt[]> {
  const companyId = input.companyId.trim();
  if (!companyId) throw new DomainError("company is required");
  if (!input.apiUrl.trim()) throw new DomainError("API URL is required");
  if (!input.idToken.trim()) throw new DomainError("ID token is required");

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${input.apiUrl.replace(/\/$/, "")}/receipts`, {
    method: "GET",
    headers: { authorization: `Bearer ${input.idToken}` },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Could not load receipts";
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object" || !("receipts" in payload) || !Array.isArray(payload.receipts)) {
    throw new DomainError("receipt list is invalid");
  }
  return payload.receipts
    .map((item) => parseCompanyReceipt(item))
    .filter((receipt) => receipt.companyId === companyId);
}

function parseCompanyReceipt(value: unknown): CompanyReceipt {
  if (!value || typeof value !== "object") throw new DomainError("receipt list is invalid");
  const record = value as Record<string, unknown>;
  const receiptId = requiredString(record.receiptId, "receipt id");
  const companyId = requiredString(record.companyId, "company");
  const merchant = requiredString(record.merchant, "merchant");
  const currency = requiredString(record.currency, "currency");
  const date = parseDateOnly(requiredString(record.date, "date"));
  const status = requiredString(record.status, "status");
  if (!STATUSES.has(status)) throw new DomainError(`unknown status: ${status}`);
  if (typeof record.amountMinor !== "number" || !Number.isSafeInteger(record.amountMinor) || record.amountMinor < 0) {
    throw new DomainError("amountMinor must be a non-negative integer");
  }
  return {
    receiptId,
    companyId,
    merchant,
    amountMinor: record.amountMinor,
    currency,
    date,
    status: status as ReceiptStatus,
  };
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new DomainError(`${label} is required`);
  return value;
}
