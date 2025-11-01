#!/usr/bin/env node
import 'source-map-support/register';
import 'dotenv/config';
import { App } from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';
import { UiStack } from '../lib/ui-stack';
import { CicdStack } from '../lib/cicd-stack';

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
};

const githubOwner =
  (app.node.tryGetContext('githubOwner') as string | undefined)
  ?? process.env.GITHUB_OWNER
  ?? 'example-owner';
const githubRepo =
  (app.node.tryGetContext('githubRepo') as string | undefined)
  ?? process.env.GITHUB_REPO
  ?? 'example-repo';
const githubBranch =
  (app.node.tryGetContext('githubBranch') as string | undefined)
  ?? process.env.GITHUB_BRANCH
  ?? 'main';

// デプロイ対象の最小化（Docker未導入環境でのバンドル回避用）
// 例: `-c only=CicdStack` / `-c only=InfraStack` / `-c only=UiStack`
const only = (app.node.tryGetContext('only') as string | undefined) ?? process.env.ONLY_STACK;

if (!only || only === 'UiStack' || only === 'InfraStack') {
  const uiStack = new UiStack(app, 'UiStack', { env });

  if (!only || only === 'InfraStack') {
    const infraStack = new InfraStack(app, 'InfraStack', {
      env,
      allowedOrigins: [`https://${uiStack.distribution.domainName}`],
    });
    infraStack.addDependency(uiStack);
  }
}

if (!only || only === 'CicdStack') {
  new CicdStack(app, 'CicdStack', {
    env,
    githubOwner,
    githubRepo,
    githubBranch,
  });
}
