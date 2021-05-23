import * as cdk from "@aws-cdk/core";
import * as cognito from "@aws-cdk/aws-cognito";
import * as lambda from "@aws-cdk/aws-lambda";
import * as appsync from "@aws-cdk/aws-appsync";
import * as ddb from "@aws-cdk/aws-dynamodb";

export class CdkProductsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Createing Userpool
    const userPool = new cognito.UserPool(this, "cdk-product-user-pool", {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.PHONE_AND_EMAIL,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          mutable: true,
          required: true,
        },
      },
    });

    //Creating userpool Client
    const userPoolClient = new cognito.UserPoolClient(
      this,
      "user-pool-client",
      {
        userPool,
      }
    );

    // Creating Api
    const api = new appsync.GraphqlApi(this, "cdk-product-api", {
      name: "cdk-product-api",
      schema: appsync.Schema.fromAsset("./graphql/schema.graphql"),
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool,
            },
          },
        ],
      },
    });

    // Creating Product Lambda Function
    const productLambda = new lambda.Function(this, "cdk-product-lambda", {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: "main.handler",
      code: lambda.Code.fromAsset("lambda-fns"),
      memorySize: 1024,
    });

    // Creating datasource
    const lambdaDs = api.addLambdaDataSource("lambdaDatasource", productLambda);

    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "getProductById",
    });

    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "listProducts",
    });

    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "productsByCategory",
    });

    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "createProduct",
    });

    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "deleteProduct",
    });

    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "updateProduct",
    });

    const productTable = new ddb.Table(this, "CDKProductTable", {
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "id",
        type: ddb.AttributeType.STRING,
      },
    });

    // Add a global secondary index to enable another data access pattern
    productTable.addGlobalSecondaryIndex({
      indexName: "productsByCategory",
      partitionKey: {
        name: "category",
        type: ddb.AttributeType.STRING,
      },
    });
    // Enable the Lambda function to access the DynamoDB table (using IAM)
    productTable.grantFullAccess(productLambda);

    // Create an environment variable that we will use in the function code
    productLambda.addEnvironment("PRODUCT_TABLE", productTable.tableName);
  }
}
