# Receipt capture infrastructure

CDK app for the presentation stack. Cleanup steps are in [CLEANUP.md](CLEANUP.md).

The stack name is `ReceiptCapturePoc`. It creates a Cognito user pool, two seeded users, an HTTP API, one Lambda, two DynamoDB tables, a private quarantine bucket, and a private portal bucket behind CloudFront. `cdk destroy` removes them.

## Demo users

| Username | Password | Company |
| --- | --- | --- |
| `northwind.demo` | `Northwind-demo-1` | `northwind` |
| `contoso.demo` | `Contoso-demo-1` | `contoso` |

These are synthetic. The app client uses `USER_PASSWORD_AUTH`. There is no hosted UI. The transactions the fake processor matches against are listed in the repo [README](../README.md#seeded-transactions). `npm run seeds` from the repo root prints them.

## Commands

From this folder, with AWS credentials for the account you want to use:

```bash
npm install
npm ci --prefix ../portal
npm test
npx cdk synth
npm run deploy
```

`npm run deploy` builds the portal, then deploys. CloudFront serves that build at [https://dyn2tqabuofe2.cloudfront.net](https://dyn2tqabuofe2.cloudfront.net). The stack output `PortalUrl` is that address. The portal bucket blocks direct public reads. `config.json` on the site is written from the stack outputs and is not baked into the JavaScript build. How to run the portal locally is in the repo [README](../README.md#review-portal).

After the presentation:

```bash
npm run destroy
```

Do not deploy this from the simcoder root. Stay in `receipt-capture/infra`.
