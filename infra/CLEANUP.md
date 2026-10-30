# Clean up after the presentation

Everything this proof of concept creates in AWS comes from this folder. The stack name is **ReceiptCapturePoc**.

Run this from `receipt-capture/infra` after the presentation:

```bash
npx cdk destroy ReceiptCapturePoc --force
```

`npm run destroy` is the same command.

That removes:

- Cognito user pool `receipt-capture-poc`, the app client, and the seeded users `northwind.demo` and `contoso.demo`
- HTTP API `receipt-capture-poc` and the API Lambda
- DynamoDB tables for receipts and idempotency keys
- The quarantine S3 bucket and the objects in it
- The seed-user Lambda

The tables, the user pool, and the bucket are created with `RemovalPolicy.DESTROY`. The bucket also has `autoDeleteObjects`, so objects do not block the bucket delete.

## If destroy says the stack does not exist

Nothing was deployed. There is nothing to delete.

## Leftover log groups

CloudFormation deletes the log groups this stack created for the API and seed Lambdas. The custom-resource provider Lambda can leave a log group behind. After destroy, in the same account and region, delete any remaining groups whose names contain `ReceiptCapturePoc`.

## Where the account and region come from

Deploy uses the account and region in your current AWS credentials (`CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION`). This folder does not name an employer account.
