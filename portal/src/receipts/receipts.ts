const STATUSES = ["Draft", "Queued", "Uploading", "Processing", "Failed", "NeedsReview", "Confirmed"] as const;

export type ReceiptStatus = (typeof STATUSES)[number];

export type PortalReceipt = {
  receiptId: string;
  companyId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
  status: ReceiptStatus;
  matchedTransactionId: string | null;
  userCorrected: boolean;
  confidence?: number;
  objectKey: string | null;
};

export type PortalTransaction = {
  id: string;
  companyId: string;
  merchant: string;
  money: { amountMinor: number; currency: string };
};

export function formatMoney(amountMinor: number, currency: string): string {
  const whole = Math.trunc(amountMinor / 100);
  const fraction = String(Math.abs(amountMinor % 100)).padStart(2, "0");
  return `${whole}.${fraction} ${currency}`;
}

export function formatConfidence(confidence: number): string {
  return `${confidence.toFixed(2)} (${Math.round(confidence * 100)}%)`;
}

export function parseReceipt(value: unknown): PortalReceipt {
  if (!value || typeof value !== "object") throw new Error("receipt is missing");
  const record = value as Record<string, unknown>;
  const status = record.status;
  if (typeof status !== "string" || !STATUSES.includes(status as ReceiptStatus)) {
    throw new Error("receipt status is invalid");
  }
  const amountMinor = record.amountMinor;
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("amountMinor must be a non-negative integer");
  }
  const confidence = record.confidence;
  let parsedConfidence: number | undefined;
  if (confidence !== null && confidence !== undefined) {
    if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error("confidence must be a number from 0 to 1");
    }
    parsedConfidence = confidence;
  }
  return {
    receiptId: requiredString(record.receiptId, "receiptId"),
    companyId: requiredString(record.companyId, "companyId"),
    merchant: requiredString(record.merchant, "merchant"),
    amountMinor,
    currency: requiredString(record.currency, "currency"),
    date: requiredString(record.date, "date"),
    status: status as ReceiptStatus,
    matchedTransactionId:
      typeof record.matchedTransactionId === "string" ? record.matchedTransactionId : null,
    userCorrected: record.userCorrected === true,
    ...(parsedConfidence === undefined ? {} : { confidence: parsedConfidence }),
    objectKey: typeof record.objectKey === "string" ? record.objectKey : null,
  };
}

export function parseReceiptList(payload: unknown): PortalReceipt[] {
  if (!payload || typeof payload !== "object" || !("receipts" in payload) || !Array.isArray(payload.receipts)) {
    throw new Error("receipt list is missing");
  }
  return payload.receipts.map(parseReceipt);
}

export function parseReceiptBody(payload: unknown): PortalReceipt {
  if (!payload || typeof payload !== "object" || !("receipt" in payload)) {
    throw new Error("receipt is missing");
  }
  return parseReceipt(payload.receipt);
}

export function parseTransactions(payload: unknown): PortalTransaction[] {
  if (!payload || typeof payload !== "object" || !("transactions" in payload) || !Array.isArray(payload.transactions)) {
    throw new Error("transaction list is missing");
  }
  return payload.transactions.map((value) => {
    if (!value || typeof value !== "object") throw new Error("transaction is missing");
    const record = value as Record<string, unknown>;
    const money = record.money;
    if (!money || typeof money !== "object") throw new Error("transaction money is missing");
    const amountMinor = (money as Record<string, unknown>).amountMinor;
    if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor)) {
      throw new Error("transaction amount is invalid");
    }
    return {
      id: requiredString(record.id, "transaction id"),
      companyId: requiredString(record.companyId, "company id"),
      merchant: requiredString(record.merchant, "merchant"),
      money: {
        amountMinor,
        currency: requiredString((money as Record<string, unknown>).currency, "currency"),
      },
    };
  });
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value;
}
