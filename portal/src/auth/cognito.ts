export type AuthTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
};

export function initiateAuthBody(clientId: string, username: string, password: string) {
  return {
    AuthFlow: "USER_PASSWORD_AUTH" as const,
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };
}

export function cognitoEndpoint(region: string): string {
  return `https://cognito-idp.${region}.amazonaws.com/`;
}

export function tokensFromInitiateAuth(payload: unknown): AuthTokens {
  if (!payload || typeof payload !== "object" || !("AuthenticationResult" in payload)) {
    throw new Error("Cognito did not return tokens");
  }
  const result = payload.AuthenticationResult;
  if (!result || typeof result !== "object") {
    throw new Error("Cognito did not return tokens");
  }
  const idToken = "IdToken" in result ? result.IdToken : undefined;
  const accessToken = "AccessToken" in result ? result.AccessToken : undefined;
  const refreshToken = "RefreshToken" in result ? result.RefreshToken : undefined;
  if (typeof idToken !== "string" || typeof accessToken !== "string" || typeof refreshToken !== "string") {
    throw new Error("Cognito did not return tokens");
  }
  return { idToken, accessToken, refreshToken };
}

export function companyIdFromIdToken(idToken: string): string | null {
  const segment = idToken.split(".")[1];
  if (!segment) return null;
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  const claims = JSON.parse(json) as Record<string, unknown>;
  const companyId = claims["custom:company_id"];
  return typeof companyId === "string" ? companyId : null;
}

export async function signInWithPassword(input: {
  region: string;
  clientId: string;
  username: string;
  password: string;
  fetchImpl?: typeof fetch;
}): Promise<AuthTokens> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(cognitoEndpoint(input.region), {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify(initiateAuthBody(input.clientId, input.username, input.password)),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "Sign-in failed";
    throw new Error(message);
  }
  return tokensFromInitiateAuth(payload);
}
