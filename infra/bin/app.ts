#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { STACK_NAME } from "../lib/demo-users.ts";
import { ReceiptCaptureStack } from "../lib/receipt-capture-stack.ts";

const app = new cdk.App();

new ReceiptCaptureStack(app, STACK_NAME, {
  description:
    "Receipt capture POC. After the presentation, destroy from receipt-capture/infra. See CLEANUP.md.",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Project: "receipt-capture",
    Purpose: "poc-presentation",
  },
});
