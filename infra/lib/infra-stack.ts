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

    const usePrebuilt = (this.node.tryGetContext('usePrebuilt') as string | undefined) === '1'
      || process.env.USE_PREBUILT === '1';
    const prebuiltPath = path.join(__dirname, '..', '..', 'api_dist');
    const apiSourcePath = path.join(__dirname, '..', '..', 'api');

    const lambdaAsset = usePrebuilt
      ? lambda.Code.fromAsset(prebuiltPath)
      : lambda.Code.fromAsset(apiSourcePath, {
          exclude: [
            '.pytest_cache',
            '.ruff_cache',
            '.venv',
            'demo',
            'demo_api.py',
            'demo_lib.py',
            'docs',
            'tests',
            '*__pycache__*',
            '*.pyc',
            'uv.lock',
            'README.md',
          ],
          bundling: {
            image: lambda.Runtime.PYTHON_3_12.bundlingImage,
            command: [
              'bash',
              '-lc',
              [
                'set -euxo pipefail',
                'pip install -r requirements-lambda.txt -t /asset-output',
                'cp -r . /asset-output',
                'find /asset-output -name "*.pyc" -delete',
              ].join(' && '),
            ],
            environment: {
              PIP_NO_CACHE_DIR: '1',
              PIP_DISABLE_PIP_VERSION_CHECK: '1',
            },
          },
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
      CORS_ALLOW_ORIGINS: Array.isArray(allowedOrigins)
        ? allowedOrigins.join(',')
        : '*',
    };

    this.apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_handler.handler',
      code: lambdaAsset,
      timeout: Duration.seconds(30),
      memorySize: 512,
      environment: apiEnvironment,
      description: 'Farm optimization API (FastAPI via Mangum).',
    });

    const workerEnvironment: Record<string, string> = {
      JOB_BACKEND: 'dynamo',
      JOBS_TABLE_NAME: this.jobsTable.tableName,
      JOB_PAYLOAD_BUCKET: this.jobBucket.bucketName,
      JOB_QUEUE_URL: this.jobQueue.queueUrl,
      JOB_QUEUE_ARN: this.jobQueue.queueArn,
      JOBS_TTL_DAYS: String(jobsTtlDays),
    };

    this.workerFunction = new lambda.Function(this, 'WorkerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'worker_handler.handler',
      code: lambdaAsset,
      timeout: Duration.minutes(15),
      memorySize: 1024,
      environment: workerEnvironment,
      description: 'Background job processor for optimization tasks.',
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
