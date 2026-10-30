import { DomainError } from "./errors.ts";

const DATE_ONLY = /^(\d{2})-(\d{2})-(\d{4})$/;

/** Calendar date with no time and no timezone. Stored as MM-DD-YYYY. */
export function parseDateOnly(value: string): string {
  const match = DATE_ONLY.exec(value.trim());
  if (!match) {
    throw new DomainError(`date must be MM-DD-YYYY: ${value}`);
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const valid =
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day;

  if (!valid) {
    throw new DomainError(`date is not a real calendar day: ${value}`);
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}
