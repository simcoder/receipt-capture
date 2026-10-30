import { DomainError } from "../../src/domain/errors.ts";
import { parseDateOnly } from "../../src/domain/dateOnly.ts";
import { moneyFromDecimal } from "../../src/domain/money.ts";
import { RECEIPT_STATUSES, transition, type ReceiptStatus } from "../../src/domain/receiptState.ts";

export { RECEIPT_STATUSES, type ReceiptStatus };

export const SYNTHETIC_IMAGES = [
  { id: "cafe-receipt", label: "Cafe receipt" },
  { id: "fuel-receipt", label: "Fuel receipt" },
  { id: "office-receipt", label: "Office receipt" },
] as const;

export type SyntheticImageId = (typeof SYNTHETIC_IMAGES)[number]["id"];

export type LocalReceipt = {
  localId: string;
  companyId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  date: string;
  imageId: SyntheticImageId;
  status: ReceiptStatus;
  idempotencyKey?: string;
  receiptId?: string;
  replayed?: boolean;
  submitSource?: "api" | "local-fake";
};

export type CaptureInput = {
  localId: string;
  companyId: string;
  merchant: string;
  amount: string;
  currency: string;
  date: string;
  imageId: string;
};

export function formatMoney(amountMinor: number, currency: string): string {
  const whole = Math.trunc(amountMinor / 100);
  const fraction = String(Math.abs(amountMinor % 100)).padStart(2, "0");
  return `${whole}.${fraction} ${currency}`;
}

export function syntheticImageLabel(imageId: SyntheticImageId): string {
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
  const image = SYNTHETIC_IMAGES.find((item) => item.id === input.imageId);
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
    imageId: image.id,
    status: "Draft",
  };
}

/** Queue acceptance is Queued. Confirmed is not a result of this action. */
export function queueDraft(receipt: LocalReceipt): LocalReceipt {
  const status = transition(receipt.status, "queue");
  if (status === "Confirmed") {
    throw new DomainError("client cannot mark Confirmed");
  }
  return { ...receipt, status };
}
