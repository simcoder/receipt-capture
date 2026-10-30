import path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cr from "aws-cdk-lib/custom-resources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { demoUsers } from "./demo-users.ts";

const lambdaDir = path.join(import.meta.dirname, "../lambda");

export class ReceiptCaptureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "Users", {
      userPoolName: "receipt-capture-poc",
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      customAttributes: {
        company_id: new cognito.StringAttribute({ minLen: 1, maxLen: 64, mutable: false }),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "AppClient", {
      userPool,
      authFlows: { userPassword: true },
      preventUserExistenceErrors: true,
      generateSecret: false,
    });

    const seedLogGroup = new logs.LogGroup(this, "SeedLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const seedFn = new lambda.Function(this, "SeedUsersFn", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "seed-user.handler",
      code: lambda.Code.fromAsset(lambdaDir),
      timeout: cdk.Duration.seconds(30),
      logGroup: seedLogGroup,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        DEMO_USERS: JSON.stringify(demoUsers),
      },
    });
    userPool.grant(
      seedFn,
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminSetUserPassword",
      "cognito-idp:AdminDeleteUser",
    );
    const seedProvider = new cr.Provider(this, "SeedUsersProvider", {
      onEventHandler: seedFn,
    });
    new cdk.CustomResource(this, "SeedUsers", {
      serviceToken: seedProvider.serviceToken,
      properties: {
        userPoolId: userPool.userPoolId,
        usernames: demoUsers.map((user) => user.username).join(","),
      },
    });

    const receipts = new dynamodb.Table(this, "Receipts", {
      partitionKey: { name: "companyId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "receiptId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const idempotency = new dynamodb.Table(this, "Idempotency", {
      partitionKey: { name: "companyId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "idempotencyKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const quarantine = new s3.Bucket(this, "Quarantine", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const apiLogGroup = new logs.LogGroup(this, "ApiLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const apiFn = new lambda.Function(this, "ApiFn", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(lambdaDir),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logGroup: apiLogGroup,
      environment: {
        RECEIPTS_TABLE: receipts.tableName,
        IDEMPOTENCY_TABLE: idempotency.tableName,
        QUARANTINE_BUCKET: quarantine.bucketName,
      },
    });
    receipts.grantReadWriteData(apiFn);
    idempotency.grantReadWriteData(apiFn);
    quarantine.grantPut(apiFn);

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "receipt-capture-poc",
      corsPreflight: {
        allowHeaders: ["authorization", "content-type", "idempotency-key"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
      },
    });
    const authorizer = new authorizers.HttpJwtAuthorizer(
      "CognitoJwt",
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );
    const integration = new integrations.HttpLambdaIntegration("ApiIntegration", apiFn);
    for (const path of [
      "/receipts",
      "/receipts/{receiptId}",
      "/receipts/{receiptId}/match",
      "/receipts/{receiptId}/reprocess",
      "/transactions",
    ]) {
      httpApi.addRoutes({
        path,
        methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
        integration,
        authorizer,
      });
    }

    new cdk.CfnOutput(this, "StackName", { value: this.stackName });
    new cdk.CfnOutput(this, "Region", { value: this.region });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "ReceiptsTableName", { value: receipts.tableName });
    new cdk.CfnOutput(this, "IdempotencyTableName", { value: idempotency.tableName });
    new cdk.CfnOutput(this, "QuarantineBucketName", { value: quarantine.bucketName });
  }
}
