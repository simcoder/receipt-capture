import { DomainError } from "../../src/domain/errors.ts";
import { parseDateOnly } from "../../src/domain/dateOnly.ts";
import { RECEIPT_STATUSES, type ReceiptStatus } from "../../src/domain/receiptState.ts";
import { SYNTHETIC_IMAGES, type LocalReceipt, type SyntheticImageId } from "./receiptDraft.ts";

export const OFFLINE_KEY = "receipt-capture.offline";

const METADATA_KEYS = [
  "localId",
  "companyId",
  "merchant",
  "amountMinor",
  "currency",
  "date",
  "imageId",
  "status",
] as const;

const IMAGE_IDS = new Set<string>(SYNTHETIC_IMAGES.map((image) => image.id));
const STATUSES = new Set<string>(RECEIPT_STATUSES);

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type LocalSession = {
  offline: boolean;
  receipts: LocalReceipt[];
};

export function queueKey(companyId: string): string {
  const company = companyId.trim();
  if (!company) {
    throw new DomainError("company is required");
  }
  return `receipt-capture.queue.${company}`;
}

/** Metadata only. Tokens and image bytes are not copied into the stored record. */
export function toQueueMetadata(receipt: LocalReceipt): Record<(typeof METADATA_KEYS)[number], string | number> {
  return {
    localId: receipt.localId,
    companyId: receipt.companyId,
    merchant: receipt.merchant,
    amountMinor: receipt.amountMinor,
    currency: receipt.currency,
    date: receipt.date,
    imageId: receipt.imageId,
    status: receipt.status,
  };
}

export function serializeQueue(receipts: readonly LocalReceipt[]): string {
  return JSON.stringify(receipts.map(toQueueMetadata));
}

export function parseQueue(raw: string | null, companyId: string): LocalReceipt[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new DomainError("queue is not a list");
  }
  return parsed.map((item) => parseReceipt(item, companyId));
}

export async function loadLocalSession(store: KeyValueStore, companyId: string): Promise<LocalSession> {
  const [rawQueue, rawOffline] = await Promise.all([
    store.getItem(queueKey(companyId)),
    store.getItem(OFFLINE_KEY),
  ]);
  return {
    receipts: parseQueue(rawQueue, companyId),
    offline: rawOffline === "1",
  };
}

export async function saveQueue(
  store: KeyValueStore,
  companyId: string,
  receipts: readonly LocalReceipt[],
): Promise<void> {
  await store.setItem(queueKey(companyId), serializeQueue(receipts));
}

export async function saveOffline(store: KeyValueStore, offline: boolean): Promise<void> {
  await store.setItem(OFFLINE_KEY, offline ? "1" : "0");
}

export async function clearCompanyQueue(store: KeyValueStore, companyId: string): Promise<void> {
  await store.removeItem(queueKey(companyId));
}

function parseReceipt(value: unknown, companyId: string): LocalReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError("receipt metadata is invalid");
  }
  const record = value as Record<string, unknown>;
  if ("imageBytes" in record || "imageBase64" in record || "base64" in record) {
    throw new DomainError("receipt images are not stored in the local queue");
  }
  if ("idToken" in record || "accessToken" in record || "refreshToken" in record) {
    throw new DomainError("tokens are not stored in the local queue");
  }

  const localId = requiredString(record.localId, "local id");
  const storedCompany = requiredString(record.companyId, "company");
  if (storedCompany !== companyId) {
    throw new DomainError(`company ${companyId} cannot read a receipt owned by ${storedCompany}`);
  }
  const merchant = requiredString(record.merchant, "merchant");
  const currency = requiredString(record.currency, "currency");
  const date = parseDateOnly(requiredString(record.date, "date"));
  const imageId = requiredString(record.imageId, "image");
  const status = requiredString(record.status, "status");
  if (!IMAGE_IDS.has(imageId)) {
    throw new DomainError(`unknown synthetic image: ${imageId}`);
  }
  if (!STATUSES.has(status)) {
    throw new DomainError(`unknown status: ${status}`);
  }
  if (typeof record.amountMinor !== "number" || !Number.isSafeInteger(record.amountMinor) || record.amountMinor < 0) {
    throw new DomainError("amountMinor must be a non-negative integer");
  }

  return {
    localId,
    companyId: storedCompany,
    merchant,
    amountMinor: record.amountMinor,
    currency,
    date,
    imageId: imageId as SyntheticImageId,
    status: status as ReceiptStatus,
  };
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new DomainError(`${label} is required`);
  }
  return value;
}
