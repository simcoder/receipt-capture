import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyValueStore } from "./localQueue";

/** Receipt metadata and the offline flag. Tokens stay in SecureStore. */
export const deviceStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
