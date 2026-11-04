import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2-alpha';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const conversationsTable = new dynamodb.Table(this, 'ConversationsTable', {
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const lambdaDir = path.join(__dirname, '..', '..', 'lambda');

    const connectFn = new lambda.Function(this, 'ConnectFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'connect.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const disconnectFn = new lambda.Function(this, 'DisconnectFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'disconnect.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const sendMessageFn = new lambda.Function(this, 'SendMessageFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'sendMessage.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
        CONVERSATIONS_TABLE: conversationsTable.tableName,
        MODEL_ID: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      },
      timeout: cdk.Duration.seconds(120),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    connectionsTable.grantWriteData(connectFn);
    connectionsTable.grantWriteData(disconnectFn);
    connectionsTable.grantReadData(sendMessageFn);
    conversationsTable.grantReadWriteData(sendMessageFn);

    sendMessageFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0`,
          `arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0`,
          `arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0`,
          `arn:aws:bedrock:us-east-1:${this.account}:inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0`,
        ],
      })
    );

    const webSocketApi = new WebSocketApi(this, 'ChatWebSocketApi', {
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration('ConnectIntegration', connectFn),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('DisconnectIntegration', disconnectFn),
      },
    });

    webSocketApi.addRoute('sendMessage', {
      integration: new WebSocketLambdaIntegration('SendMessageIntegration', sendMessageFn),
    });

    const stage = new WebSocketStage(this, 'ProdStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    sendMessageFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/${stage.stageName}/POST/@connections/*`,
        ],
      })
    );

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: stage.url,
      description: 'WebSocket API URL',
    });

    new cdk.CfnOutput(this, 'ConnectionsTableName', {
      value: connectionsTable.tableName,
    });

    new cdk.CfnOutput(this, 'ConversationsTableName', {
      value: conversationsTable.tableName,
    });
  }
}
