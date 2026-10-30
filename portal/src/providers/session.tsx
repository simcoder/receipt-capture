import { createContext, useContext, useState, type ReactNode } from "react";
import { companyIdFromIdToken, signInWithPassword } from "../auth/cognito.ts";
import type { PortalConfig } from "../config.ts";

type Session = {
  config: PortalConfig;
  idToken: string | null;
  companyId: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  logOut: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider(props: { config: PortalConfig; children: ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null);
  const companyId = idToken ? companyIdFromIdToken(idToken) : null;

  async function signIn(username: string, password: string) {
    const tokens = await signInWithPassword({
      region: props.config.region,
      clientId: props.config.userPoolClientId,
      username,
      password,
    });
    setIdToken(tokens.idToken);
  }

  function logOut() {
    setIdToken(null);
  }

  return (
    <SessionContext.Provider value={{ config: props.config, idToken, companyId, signIn, logOut }}>
      {props.children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is missing");
  return session;
}
