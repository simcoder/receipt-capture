import { DomainError } from "./errors.ts";

export type QueuedReceipt = {
  localId: string;
  companyId: string;
};

export function assertCanUpload(actorCompanyId: string, item: QueuedReceipt): void {
  if (item.companyId !== actorCompanyId) {
    throw new DomainError(
      `company ${actorCompanyId} cannot upload a receipt owned by ${item.companyId}`,
    );
  }
}

/** Logout drops the local queue before another company can sign in. */
export function clearQueueOnLogout(): QueuedReceipt[] {
  return [];
}
