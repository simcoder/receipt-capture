import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  afterLogout,
  companyIdFromIdToken,
  initiateAuthBody,
  SECURE_STORE_KEYS,
  signInWithPassword,
} from "../mobile/src/cognitoAuth.ts";

function fakeIdToken(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `header.${payload}.sig`;
}

describe("cognito sign-in", () => {
  it("sends USER_PASSWORD_AUTH and stores the returned tokens", async () => {
    const requests: { url: string; body: string; headers: Record<string, string> }[] = [];
    const tokens = await signInWithPassword({
      region: "us-east-1",
      clientId: "client-123",
      username: "northwind.demo",
      password: "Northwind-demo-1",
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          body: String(init?.body),
          headers: init?.headers as Record<string, string>,
        });
        return new Response(
          JSON.stringify({
            AuthenticationResult: {
              IdToken: fakeIdToken({ "custom:company_id": "northwind" }),
              AccessToken: "access",
              RefreshToken: "refresh",
            },
          }),
          { status: 200 },
        );
      },
    });

    assert.equal(requests[0]?.url, "https://cognito-idp.us-east-1.amazonaws.com/");
    assert.equal(
      requests[0]?.headers["x-amz-target"],
      "AWSCognitoIdentityProviderService.InitiateAuth",
    );
    assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: "client-123",
      AuthParameters: { USERNAME: "northwind.demo", PASSWORD: "Northwind-demo-1" },
    });
    assert.equal(companyIdFromIdToken(tokens.idToken), "northwind");
    assert.equal(initiateAuthBody("c", "u", "p").AuthFlow, "USER_PASSWORD_AUTH");
  });
});

describe("logout", () => {
  it("clears SecureStore keys and the local queue", () => {
    const cleared = afterLogout([
      { localId: "local-1", companyId: "northwind" },
      { localId: "local-2", companyId: "northwind" },
    ]);
    assert.deepEqual(cleared.queue, []);
    assert.deepEqual([...cleared.deleteKeys], [...SECURE_STORE_KEYS]);
  });
});
