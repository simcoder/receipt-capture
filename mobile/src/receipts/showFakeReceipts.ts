/** Cafe, fuel, and office buttons. Off unless this env value is exactly "1". */
export function showFakeReceipts(value: string | undefined = process.env.EXPO_PUBLIC_SHOW_FAKE_RECEIPTS): boolean {
  return value === "1";
}
