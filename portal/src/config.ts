export type PortalConfig = {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  apiUrl: string;
};

export function parsePortalConfig(value: unknown): PortalConfig {
  if (!value || typeof value !== "object") {
    throw new Error("portal config is missing");
  }
  const record = value as Record<string, unknown>;
  const region = required(record.region, "region");
  const userPoolId = required(record.userPoolId, "user pool id");
  const userPoolClientId = required(record.userPoolClientId, "app client id");
  const apiUrl = required(record.apiUrl, "API URL").replace(/\/$/, "");
  return { region, userPoolId, userPoolClientId, apiUrl };
}

function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}
