export type NetworkSnapshot = {
  isConnected?: boolean;
};

/** True until the device reports that it has no network. */
export function isDeviceOnline(state: NetworkSnapshot | null): boolean {
  if (!state) return true;
  return state.isConnected !== false;
}
