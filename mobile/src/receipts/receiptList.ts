import { parseDateOnly } from "../../../src/domain/dateOnly.ts";
import { DomainError } from "../../../src/domain/errors.ts";
import { RECEIPT_STATUSES, type ReceiptStatus } from "../../../src/domain/receiptState.ts";
import { apiErrorMessage, apiRequest } from "../api/client.ts";

const STATUSES = new Set<string>(RECEIPT_STATUSES);

export type CompanyReceipt = {
  receiptId: string;
  companyId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
  status: ReceiptStatus;
  matchedTransactionId?: string;
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

  const result = await apiRequest({
    apiUrl: input.apiUrl,
    idToken: input.idToken,
    path: "/receipts",
    method: "GET",
    fetchImpl: input.fetchImpl,
  });
  if (!result.ok) throw new Error(apiErrorMessage(result.payload, "Could not load receipts"));
  const payload = result.payload;
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
    ...matchedTransactionId(record.matchedTransactionId),
  };
}

function matchedTransactionId(value: unknown): { matchedTransactionId: string } | Record<string, never> {
  if (value == null || value === "") return {};
  if (typeof value !== "string") throw new DomainError("matched transaction is invalid");
  return { matchedTransactionId: value };
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new DomainError(`${label} is required`);
  return value;
}
