import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { companyIdFromIdToken, SECURE_STORE_KEYS, signInWithPassword } from "../auth/cognitoAuth";

const region = process.env.EXPO_PUBLIC_COGNITO_REGION ?? "";
const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? "";
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

type SessionValue = {
  region: string;
  clientId: string;
  apiUrl: string;
  idToken: string | null;
  companyId: string;
  busy: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  clearTokens: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider(props: { children: ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(SECURE_STORE_KEYS[0])
      .then((storedId) => setIdToken(storedId))
      .finally(() => setBusy(false));
  }, []);

  const value = useMemo<SessionValue>(() => {
    return {
      region,
      clientId,
      apiUrl,
      idToken,
      companyId: idToken ? (companyIdFromIdToken(idToken) ?? "") : "",
      busy,
      async signIn(username: string, password: string) {
        if (!region || !clientId) {
          throw new Error("Set the Cognito region and app client id from the infra stack outputs.");
        }
        setBusy(true);
        try {
          const tokens = await signInWithPassword({
            region,
            clientId,
            username: username.trim(),
            password,
          });
          await SecureStore.setItemAsync(SECURE_STORE_KEYS[0], tokens.idToken);
          await SecureStore.setItemAsync(SECURE_STORE_KEYS[1], tokens.accessToken);
          await SecureStore.setItemAsync(SECURE_STORE_KEYS[2], tokens.refreshToken);
          setIdToken(tokens.idToken);
        } finally {
          setBusy(false);
        }
      },
      async clearTokens() {
        await Promise.all(SECURE_STORE_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
        setIdToken(null);
      },
    };
  }, [idToken, busy]);

  return <SessionContext.Provider value={value}>{props.children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
