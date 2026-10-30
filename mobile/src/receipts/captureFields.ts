/** Digits and one decimal point. A third decimal digit is dropped. */
export function maskAmount(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot < 0) return cleaned;
  const whole = cleaned.slice(0, dot);
  const fraction = cleaned.slice(dot + 1).replaceAll(".", "").slice(0, 2);
  return `${whole}.${fraction}`;
}

/** Local calendar day as MM-DD-YYYY. No time and no timezone. */
export function formatDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}-${day}-${year}`;
}

/** Picker value for a stored MM-DD-YYYY string. An empty field uses fallback. */
export function dateFromStored(value: string, fallback: Date): Date {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return fallback;
  return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
}
