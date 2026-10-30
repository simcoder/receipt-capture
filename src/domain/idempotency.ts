import { DomainError } from "./errors.ts";

export type IdempotencyRecord = {
  key: string;
  companyId: string;
  receiptId: string;
};

export type SubmitResolution = {
  records: IdempotencyRecord[];
  receiptId: string;
  replayed: boolean;
};

/**
 * First submit stores the receipt id for this company and key.
 * A retry, including one whose first success response was lost, returns that same receipt id.
 * The key is scoped to the company. It lives for the life of the stored record in this POC.
 */
export function resolveSubmit(
  records: readonly IdempotencyRecord[],
  input: { key: string; companyId: string; receiptId: string },
): SubmitResolution {
  const key = input.key.trim();
  if (!key) {
    throw new DomainError("idempotency key is required");
  }

  const existing = records.find((record) => record.key === key);
  if (existing) {
    if (existing.companyId !== input.companyId) {
      throw new DomainError("idempotency key belongs to another company");
    }
    return { records: [...records], receiptId: existing.receiptId, replayed: true };
  }

  const created: IdempotencyRecord = {
    key,
    companyId: input.companyId,
    receiptId: input.receiptId,
  };
  return { records: [...records, created], receiptId: created.receiptId, replayed: false };
}
