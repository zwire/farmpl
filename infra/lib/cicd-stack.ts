import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface CicdStackProps extends StackProps {
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly githubBranch?: string;
  readonly roleName?: string;
}

export class CicdStack extends Stack {
  public readonly provider: iam.OpenIdConnectProvider;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    const branch = props.githubBranch ?? 'main';
    const roleName = props.roleName ?? `${props.githubOwner}-${props.githubRepo}-deploy`.replace(
      /[^A-Za-z0-9+=,.@_-]/g,
      '-',
    );

    this.provider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const subCondition = `repo:${props.githubOwner}/${props.githubRepo}:ref:refs/heads/${branch}`;

    this.role = new iam.Role(this, 'GithubDeployRole', {
      roleName,
      assumedBy: new iam.WebIdentityPrincipal(this.provider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': subCondition,
        },
      }),
      description: 'Role assumed by GitHub Actions via OIDC to deploy CDK stacks.',
      maxSessionDuration: Duration.hours(12),
    });

    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
    );

    new CfnOutput(this, 'GithubOidcProviderArn', {
      value: this.provider.openIdConnectProviderArn,
    });

    new CfnOutput(this, 'GithubDeployRoleArn', {
      value: this.role.roleArn,
    });
  }
}
