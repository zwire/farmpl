import {
  Duration,
  RemovalPolicy,
  SecretValue,
  Stack,
  StackProps,
  CfnOutput,
} from 'aws-cdk-lib';
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface InfraStackProps extends StackProps {
  readonly allowedOrigins?: string[];
  readonly jobsTtlDays?: number;
}

export class InfraStack extends Stack {
  public readonly apiFunction: lambda.Function;
  public readonly workerFunction: lambda.Function;
  public readonly jobQueue: sqs.Queue;
  public readonly jobBucket: s3.Bucket;
  public readonly jobsTable: dynamodb.Table;
  public readonly apiKeysSecret: secretsmanager.Secret;
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: InfraStackProps = {}) {
    super(scope, id, props);

    const jobsTtlDays = props.jobsTtlDays ?? 365;
    const allowedOrigins = props.allowedOrigins && props.allowedOrigins.length > 0
      ? props.allowedOrigins
      : apigateway.Cors.ALL_ORIGINS;

    const apiDir = path.join(__dirname, '..', '..', 'api');
    const apiDockerCode = lambda.DockerImageCode.fromImageAsset(apiDir, {
      file: 'Dockerfile.lambda.api',
    });
    const workerDockerCode = lambda.DockerImageCode.fromImageAsset(apiDir, {
      file: 'Dockerfile.lambda.worker',
    });

    this.jobBucket = new s3.Bucket(this, 'JobPayloadBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [
        {
          expiration: Duration.days(jobsTtlDays),
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
    });

    this.jobsTable = new dynamodb.Table(this, 'JobsTable', {
      partitionKey: { name: 'job_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expires_at',
      removalPolicy: RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    const deadLetterQueue = new sqs.Queue(this, 'JobDlq', {
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    });

    this.jobQueue = new sqs.Queue(this, 'JobQueue', {
      visibilityTimeout: Duration.minutes(15),
      retentionPeriod: Duration.days(4),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: deadLetterQueue,
      },
    });

    this.apiKeysSecret = new secretsmanager.Secret(this, 'ApiKeysSecret', {
      description: 'API keys for the Farm optimization API (JSON payload with keys array).',
      secretStringValue: SecretValue.unsafePlainText(JSON.stringify({ keys: [] })),
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const apiEnvironment: Record<string, string> = {
      AUTH_MODE: 'api_key',
      JOB_BACKEND: 'dynamo',
      JOBS_TABLE_NAME: this.jobsTable.tableName,
      JOB_PAYLOAD_BUCKET: this.jobBucket.bucketName,
      JOB_QUEUE_URL: this.jobQueue.queueUrl,
      JOB_QUEUE_ARN: this.jobQueue.queueArn,
      JOBS_TTL_DAYS: String(jobsTtlDays),
      API_KEYS_SECRET_ARN: this.apiKeysSecret.secretArn,
      // API Gatewayの統合上限（約29秒）に合わせ、同期APIの自前タイムアウトも調整
      SYNC_TIMEOUT_MS: '29000',
      CORS_ALLOW_ORIGINS: Array.isArray(allowedOrigins)
        ? allowedOrigins.join(',')
        : '*',
    };

    this.apiFunction = new lambda.DockerImageFunction(this, 'ApiFunction', {
      code: apiDockerCode,
      // API Gateway 側の上限に合わせて29秒
      timeout: Duration.seconds(29),
      // 少し余裕を持たせてCPUを増強
      memorySize: 1024,
      environment: apiEnvironment,
      description: 'Farm optimization API (FastAPI via Mangum) - container image.',
    });

    const workerEnvironment: Record<string, string> = {
      JOB_BACKEND: 'dynamo',
      JOBS_TABLE_NAME: this.jobsTable.tableName,
      JOB_PAYLOAD_BUCKET: this.jobBucket.bucketName,
      JOB_QUEUE_URL: this.jobQueue.queueUrl,
      JOB_QUEUE_ARN: this.jobQueue.queueArn,
      JOBS_TTL_DAYS: String(jobsTtlDays),
    };

    this.workerFunction = new lambda.DockerImageFunction(this, 'WorkerFunction', {
      code: workerDockerCode,
      timeout: Duration.minutes(15),
      memorySize: 1536,
      environment: workerEnvironment,
      description: 'Background job processor (container image).',
    });

    this.workerFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.jobQueue, {
        batchSize: 1,
      }),
    );

    this.jobsTable.grantReadWriteData(this.apiFunction);
    this.jobsTable.grantReadWriteData(this.workerFunction);
    this.jobBucket.grantReadWrite(this.apiFunction);
    this.jobBucket.grantReadWrite(this.workerFunction);
    this.jobQueue.grantSendMessages(this.apiFunction);
    this.jobQueue.grantConsumeMessages(this.workerFunction);
    this.apiKeysSecret.grantRead(this.apiFunction);

    this.apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sqs:GetQueueAttributes'],
        resources: [this.jobQueue.queueArn],
      }),
    );

    this.restApi = new apigateway.LambdaRestApi(this, 'HttpApi', {
      handler: this.apiFunction,
      proxy: true,
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowCredentials: true,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowOrigins: Array.isArray(allowedOrigins)
          ? allowedOrigins
          : apigateway.Cors.ALL_ORIGINS,
      },
    });

    // Ensure CORS headers are also returned on API Gateway default 4XX/5XX responses
    // (e.g., when Lambda is not invoked or errors occur before integration).
    const corsOriginHeader = Array.isArray(allowedOrigins) && allowedOrigins.length > 0
      ? `'${allowedOrigins[0]}'`
      : "'*'";
    const corsHeaders: { [header: string]: string } = {
      'Access-Control-Allow-Origin': corsOriginHeader,
      'Access-Control-Allow-Headers': "'*'",
      'Access-Control-Allow-Methods': "'*'",
    };
    this.restApi.addGatewayResponse('Default4xxWithCors', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: corsHeaders,
    });
    this.restApi.addGatewayResponse('Default5xxWithCors', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: corsHeaders,
    });

    new CfnOutput(this, 'ApiBaseUrl', {
      value: this.restApi.url ?? '',
    });

    new CfnOutput(this, 'JobQueueUrl', {
      value: this.jobQueue.queueUrl,
    });

    new CfnOutput(this, 'JobPayloadBucketName', {
      value: this.jobBucket.bucketName,
    });

    new CfnOutput(this, 'JobsTableName', {
      value: this.jobsTable.tableName,
    });

    new CfnOutput(this, 'ApiKeysSecretArn', {
      value: this.apiKeysSecret.secretArn,
    });
  }
}
