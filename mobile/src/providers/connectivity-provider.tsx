import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as Network from "expo-network";
import { isDeviceOnline } from "./connectivity";

type ConnectivityValue = {
  online: boolean;
};

const ConnectivityContext = createContext<ConnectivityValue>({ online: true });

export function ConnectivityProvider(props: { children: ReactNode }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Network.getNetworkStateAsync()
      .then((state) => {
        if (!cancelled) setOnline(isDeviceOnline(state));
      })
      .catch(() => {
        if (!cancelled) setOnline(true);
      });
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(isDeviceOnline(state));
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return <ConnectivityContext.Provider value={{ online }}>{props.children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityValue {
  return useContext(ConnectivityContext);
}
