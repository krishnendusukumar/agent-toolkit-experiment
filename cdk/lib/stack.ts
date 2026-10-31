import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export class AgentToolkitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: 'AgentToolkit-Connections',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const messagesTable = new dynamodb.Table(this, 'MessagesTable', {
      tableName: 'AgentToolkit-Messages',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const webSocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: 'AgentToolkitWebSocket',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    const connectLogGroup = new logs.LogGroup(this, 'ConnectLogGroup', {
      logGroupName: '/aws/lambda/AgentToolkit-Connect',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const disconnectLogGroup = new logs.LogGroup(this, 'DisconnectLogGroup', {
      logGroupName: '/aws/lambda/AgentToolkit-Disconnect',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const messageLogGroup = new logs.LogGroup(this, 'MessageLogGroup', {
      logGroupName: '/aws/lambda/AgentToolkit-Message',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const connectFn = new lambda.Function(this, 'ConnectFn', {
      functionName: 'AgentToolkit-Connect',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'connect')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logGroup: connectLogGroup,
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
      },
    });

    const disconnectFn = new lambda.Function(this, 'DisconnectFn', {
      functionName: 'AgentToolkit-Disconnect',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'disconnect')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logGroup: disconnectLogGroup,
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
      },
    });

    const messageFn = new lambda.Function(this, 'MessageFn', {
      functionName: 'AgentToolkit-Message',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'message')),
      timeout: cdk.Duration.seconds(120),
      memorySize: 512,
      logGroup: messageLogGroup,
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
        MESSAGES_TABLE: messagesTable.tableName,
        BEDROCK_MODEL_ID: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
        AWS_REGION_NAME: cdk.Stack.of(this).region,
      },
    });

    connectionsTable.grantReadWriteData(connectFn);
    connectionsTable.grantReadWriteData(disconnectFn);
    connectionsTable.grantReadWriteData(messageFn);
    messagesTable.grantReadWriteData(messageFn);

    messageFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModelWithResponseStream'],
      resources: [
        'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0',
        'arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0',
        'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0',
        `arn:aws:bedrock:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0`,
      ],
    }));

    const connectIntegration = new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
      apiId: webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Stack.of(this).region}:lambda:path/2015-03-31/functions/${connectFn.functionArn}/invocations`,
    });

    const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
      apiId: webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Stack.of(this).region}:lambda:path/2015-03-31/functions/${disconnectFn.functionArn}/invocations`,
    });

    const messageIntegration = new apigatewayv2.CfnIntegration(this, 'MessageIntegration', {
      apiId: webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Stack.of(this).region}:lambda:path/2015-03-31/functions/${messageFn.functionArn}/invocations`,
    });

    const connectRoute = new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
      apiId: webSocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      target: `integrations/${connectIntegration.ref}`,
    });

    const disconnectRoute = new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: webSocketApi.ref,
      routeKey: '$disconnect',
      target: `integrations/${disconnectIntegration.ref}`,
    });

    const sendMessageRoute = new apigatewayv2.CfnRoute(this, 'SendMessageRoute', {
      apiId: webSocketApi.ref,
      routeKey: 'sendMessage',
      target: `integrations/${messageIntegration.ref}`,
    });

    const deployment = new apigatewayv2.CfnDeployment(this, 'Deployment', {
      apiId: webSocketApi.ref,
    });
    deployment.addDependency(connectRoute);
    deployment.addDependency(disconnectRoute);
    deployment.addDependency(sendMessageRoute);

    new apigatewayv2.CfnStage(this, 'ProdStage', {
      apiId: webSocketApi.ref,
      stageName: 'prod',
      deploymentId: deployment.ref,
    });

    connectFn.addPermission('ApiGwConnect', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${webSocketApi.ref}/*/$connect`,
    });

    disconnectFn.addPermission('ApiGwDisconnect', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${webSocketApi.ref}/*/$disconnect`,
    });

    messageFn.addPermission('ApiGwMessage', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${webSocketApi.ref}/*/sendMessage`,
    });

    messageFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${webSocketApi.ref}/prod/POST/@connections/*`,
      ],
    }));

    const wsUrl = `wss://${webSocketApi.ref}.execute-api.${cdk.Stack.of(this).region}.amazonaws.com/prod`;

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: wsUrl,
      description: 'WebSocket API URL',
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: webSocketApi.ref,
      description: 'API Gateway WebSocket API ID',
    });
  }
}