import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { isDeviceOnline } from "./connectivity";

type ConnectivityValue = {
  online: boolean;
};

const ConnectivityContext = createContext<ConnectivityValue>({ online: true });

export function ConnectivityProvider(props: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const onlineRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let reading = false;

    const apply = (state: { isConnected?: boolean }) => {
      if (cancelled) return;
      const next = isDeviceOnline(state);
      onlineRef.current = next;
      setOnline(next);
    };

    const read = () => {
      if (cancelled || reading) return;
      reading = true;
      Network.getNetworkStateAsync()
        .then(apply)
        .catch(() => undefined)
        .finally(() => {
          reading = false;
        });
    };

    read();
    const subscription = Network.addNetworkStateListener(apply);
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") read();
    });
    // The iOS path monitor reports Wi-Fi dropping, then does not report it coming back.
    const timer = setInterval(() => {
      if (!onlineRef.current) read();
    }, 1000);

    return () => {
      cancelled = true;
      subscription.remove();
      appState.remove();
      clearInterval(timer);
    };
  }, []);

  return <ConnectivityContext.Provider value={{ online }}>{props.children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityValue {
  return useContext(ConnectivityContext);
}
