import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

function users() {
  return JSON.parse(process.env.DEMO_USERS ?? "[]");
}

export async function handler(event) {
  const userPoolId = process.env.USER_POOL_ID;
  if (event.RequestType === "Delete") {
    for (const user of users()) {
      try {
        await client.send(
          new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: user.username }),
        );
      } catch (error) {
        if (error.name !== "UserNotFoundException") throw error;
      }
    }
    return { PhysicalResourceId: event.PhysicalResourceId ?? "receipt-capture-demo-users" };
  }

  for (const user of users()) {
    try {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: user.username,
          MessageAction: "SUPPRESS",
          UserAttributes: [{ Name: "custom:company_id", Value: user.companyId }],
        }),
      );
    } catch (error) {
      if (error.name !== "UsernameExistsException") throw error;
    }
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: user.username,
        Password: user.password,
        Permanent: true,
      }),
    );
  }

  return { PhysicalResourceId: "receipt-capture-demo-users" };
}
