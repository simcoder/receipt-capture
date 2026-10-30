import { DomainError } from "../../../src/domain/errors.ts";
import { parseDateOnly } from "../../../src/domain/dateOnly.ts";
import { moneyFromDecimal } from "../../../src/domain/money.ts";
import { RECEIPT_STATUSES, transition, type ReceiptStatus } from "../../../src/domain/receiptState.ts";

export { RECEIPT_STATUSES, type ReceiptStatus };

export const SYNTHETIC_IMAGES = [
  { id: "cafe-receipt", label: "Cafe receipt" },
  { id: "fuel-receipt", label: "Fuel receipt" },
  { id: "office-receipt", label: "Office receipt" },
] as const;

export type SyntheticImageId = (typeof SYNTHETIC_IMAGES)[number]["id"];

/** Metadata for a photo taken this visit. The bytes are not this id. */
export const DEVICE_PHOTO_ID = "device-photo";

export type ReceiptImageId = SyntheticImageId | typeof DEVICE_PHOTO_ID;

export type LocalReceipt = {
  localId: string;
  companyId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
  imageId: ReceiptImageId;
  notes?: string;
  status: ReceiptStatus;
  idempotencyKey?: string;
  receiptId?: string;
  replayed?: boolean;
  submitSource?: "api" | "local-fake";
  matchedTransactionId?: string;
  userCorrected?: boolean;
};

export type CaptureInput = {
  localId: string;
  companyId: string;
  merchant: string;
  amount: string;
  currency: string;
  date: string;
  imageId: string;
  notes?: string;
};

export function formatMoney(amountMinor: number, currency: string): string {
  const whole = Math.trunc(amountMinor / 100);
  const fraction = String(Math.abs(amountMinor % 100)).padStart(2, "0");
  return `${whole}.${fraction} ${currency}`;
}

export function syntheticImageLabel(imageId: ReceiptImageId): string {
  if (imageId === DEVICE_PHOTO_ID) return "Photo";
  const image = SYNTHETIC_IMAGES.find((item) => item.id === imageId);
  if (!image) {
    throw new DomainError(`unknown synthetic image: ${imageId}`);
  }
  return image.label;
}

/** A new receipt is always Draft. This screen cannot mark Confirmed. */
export function captureDraft(input: CaptureInput): LocalReceipt {
  const merchant = input.merchant.trim();
  if (!merchant) {
    throw new DomainError("merchant is required");
  }
  const companyId = input.companyId.trim();
  if (!companyId) {
    throw new DomainError("company is required");
  }
  const localId = input.localId.trim();
  if (!localId) {
    throw new DomainError("local id is required");
  }
  const image =
    input.imageId === DEVICE_PHOTO_ID
      ? DEVICE_PHOTO_ID
      : SYNTHETIC_IMAGES.find((item) => item.id === input.imageId)?.id;
  if (!image) {
    throw new DomainError("pick a synthetic image");
  }
  const money = moneyFromDecimal(input.amount, input.currency);
  return {
    localId,
    companyId,
    merchant,
    amountMinor: money.amountMinor,
    currency: money.currency,
    date: parseDateOnly(input.date),
    imageId: image,
    status: "Draft",
    ...optionalNotes(input.notes),
  };
}

function optionalNotes(value: string | undefined): { notes: string } | Record<string, never> {
  const notes = value?.trim() ?? "";
  if (!notes) return {};
  return { notes };
}

/** Signed-in capture submits while online and queues while offline. */
export function captureActionLabel(input: { signedIn: boolean; online: boolean }): string {
  if (!input.signedIn) return "Save draft";
  return input.online ? "Submit" : "Queue receipt";
}

/** Queued receipts that have not reached the server yet. */
export function receiptsWaitingToSubmit(receipts: readonly LocalReceipt[]): LocalReceipt[] {
  return receipts.filter((receipt) => receipt.status === "Queued" && !receipt.receiptId);
}

/** Queue acceptance is Queued. Confirmed is not a result of this action. */
export function queueDraft(receipt: LocalReceipt): LocalReceipt {
  const status = transition(receipt.status, "queue");
  if (status === "Confirmed") {
    throw new DomainError("client cannot mark Confirmed");
  }
  return { ...receipt, status };
}
