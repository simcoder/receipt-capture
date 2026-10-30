/** Matches the API quarantine limit in infra/lambda/handler.mjs. */
export const MAX_QUARANTINE_BYTES = 500_000;

/** Returns the base64 payload when it is within the quarantine limit. */
export function quarantineImage(value: string): string | undefined {
  const encoded = value.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (!encoded) return undefined;
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((encoded.length * 3) / 4) - padding;
  if (bytes <= 0 || bytes > MAX_QUARANTINE_BYTES) return undefined;
  return encoded;
}
