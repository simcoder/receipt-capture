import { DomainError } from "./errors.ts";

export const RECEIPT_STATUSES = [
  "Draft",
  "Queued",
  "Uploading",
  "Processing",
  "Failed",
  "NeedsReview",
  "Confirmed",
] as const;

export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export type ReceiptEvent =
  | "queue"
  | "startUpload"
  | "acceptUpload"
  | "fail"
  | "serverConfirm"
  | "needsReview"
  | "userConfirm"
  | "retry";

const TRANSITIONS: Record<ReceiptStatus, Partial<Record<ReceiptEvent, ReceiptStatus>>> = {
  Draft: { queue: "Queued" },
  Queued: { startUpload: "Uploading" },
  Uploading: { acceptUpload: "Processing", fail: "Failed" },
  Processing: { serverConfirm: "Confirmed", needsReview: "NeedsReview", fail: "Failed" },
  Failed: { retry: "Queued" },
  NeedsReview: { userConfirm: "Confirmed" },
  Confirmed: {},
};

export function transition(from: ReceiptStatus, event: ReceiptEvent): ReceiptStatus {
  const next = TRANSITIONS[from][event];
  if (!next) {
    throw new DomainError(`cannot ${event} from ${from}`);
  }
  return next;
}

/** Local queue acceptance is Queued. Confirmed happens only after a server or user confirm event. */
export function acceptIntoQueue(): ReceiptStatus {
  return transition("Draft", "queue");
}
