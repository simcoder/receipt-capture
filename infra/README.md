# Receipt capture infrastructure

CDK app for the presentation stack. Cleanup steps are in [CLEANUP.md](CLEANUP.md).

The stack name is `ReceiptCapturePoc`. It creates a Cognito user pool, two seeded users, an HTTP API, one Lambda, two DynamoDB tables, and a private quarantine bucket. `cdk destroy` removes them.

## Demo users

| Username | Password | Company |
| --- | --- | --- |
| `northwind.demo` | `Northwind-demo-1` | `northwind` |
| `contoso.demo` | `Contoso-demo-1` | `contoso` |

These are synthetic. The app client uses `USER_PASSWORD_AUTH`. There is no hosted UI.

## Commands

From this folder, with AWS credentials for the account you want to use:

```bash
npm install
npm test
npx cdk synth
npm run deploy
```

After the presentation:

```bash
npm run destroy
```

Do not deploy this from the simcoder root. Stay in `receipt-capture/infra`.
