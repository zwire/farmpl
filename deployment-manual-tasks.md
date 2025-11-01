# 手動オペレーション手順（初期セットアップ/運用）

> ここでは、人間がAWS/GitHubで行う必要がある作業をまとめます。初回セットアップ後は、基本的に`main`へのpushで自動デプロイが回る想定です。

---

## 1) 前提
- 本環境の値
  - `AWS_ACCOUNT_ID = 111111111111`
  - `AWS_REGION = ap-northeast-1`
  - `GitHub` リポジトリ: `zwire/farmpl`
- ローカルに `aws-cli` / `node` / `npm` / `cdk` をインストール済み
- `AWS_ACCESS_KEY`, `AWS_SECRET_KEY` を取得しておく (`aws configure` で使用)
- GitHub リポジトリに管理者権限を保有

---

## 2) CDK ブートストラップ（初回のみ）
```bash
export AWS_ACCOUNT_ID=111111111111
export AWS_REGION=ap-northeast-1
aws configure
cd infra
npm ci && npm run build
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
```

---

## 3) GitHub OIDC 用ロールの作成（初回のみ）

CDKの `CicdStack` に OIDC Provider と `GithubDeployRole` を含めます。初回はローカル資格情報で一度だけデプロイしてください。

```bash
cd infra
# Docker 未導入のマシンでは、CicdStack のみを合成/デプロイ（Pythonバンドル回避）
npx cdk deploy CicdStack \
  -c only=CicdStack \
  -c githubOwner=zwire \
  -c githubRepo=farmpl \
  -c githubBranch=main
```

ロールの信頼ポリシーは GitHub `repo:<owner>/<repo>` とブランチ `refs/heads/main` を条件にします（CDKで設定）。

---

## 4) GitHub リポジトリ設定

リポジトリ → Settings → Security → Actions → OIDC を有効化（既定で有効）。

リポジトリ → Settings → Secrets and variables:

- Repository variables（Variables）
  - `AWS_REGION` = `ap-northeast-1`
  - `AWS_ROLE_TO_ASSUME` = `arn:aws:iam::111111111111:role/zwire-farmpl-deploy` （CicdStackの出力値）

Secrets は基本不要（OIDCを利用するためアクセスキーは不要）。

---

## 5) 初回インフラデプロイ（手動 or Actions）

最初はinfraのみデプロイし、Outputsを確認します。

ローカルに Docker が無い場合は、先にローカルでLambda資材を事前ビルドしてから `usePrebuilt=1` でCDKを実行します。

```bash
# 1) 事前ビルド（依存を vendor し、ソースを api_dist/ に出力）
./scripts/build-lambda.sh

# 2) 事前ビルド資材を使用してデプロイ（Docker不要）
cd infra
npx cdk deploy InfraStack UiStack -c usePrebuilt=1 --require-approval never
# ApiBaseUrl, UiDistributionDomainName などを控える
```

Docker が利用可能な環境（例: GitHub Actions）では、`-c usePrebuilt=1` なしでそのまま実行して問題ありません。

---

## 6) API鍵（本番認可）の投入（Secrets Manager）

CDKで `ApiKeysSecretArn`（空）が作られます。以下のように値を設定します（複数可）。

```bash
aws secretsmanager put-secret-value \
  --secret-id ApiKeysSecretArn \
  --secret-string '{"keys": ["xxxxxxxxxxxx"]}'
```

Lambda は起動時にこのシークレットを読み取り、`AUTH_MODE=api_key` の場合のみ検証します。

---

## 7) GitHub Actions での自動デプロイ

`main` へ push すると以下の流れで動きます（ワークフローは実装側で追加）。

1. OIDCで `AWS_ROLE_TO_ASSUME` をAssume
2. `cdk deploy` で `InfraStack`/`UiStack` を更新
3. `cdk output` から `ApiBaseUrl` を取得し、`NEXT_PUBLIC_API_BASE_URL` として `ui/` をビルド
4. `aws s3 sync ui/out s3://<UiBucket>` し、`cloudfront create-invalidation --paths '/*'`

ワークフロー例（抜粋）:

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_TO_ASSUME }}
          aws-region: ${{ vars.AWS_REGION }}
      - name: CDK Deploy
        run: |
          cd infra
          npm ci
          npx cdk deploy InfraStack UiStack --require-approval never
          API_URL=$(npx cdk output --quiet InfraStack.ApiBaseUrl)
          echo "API_URL=$API_URL" >> $GITHUB_ENV
      - name: Build UI
        run: |
          cd ui
          npm ci
          NEXT_PUBLIC_API_BASE_URL=$API_URL npm run build
          npx next export
      - name: Upload UI
        run: |
          UI_BUCKET=$(npx cdk output --quiet InfraStack.UiBucketName)
          DIST_DOMAIN=$(npx cdk output --quiet UiStack.UiDistributionDomainName)
          aws s3 sync ui/out s3://$UI_BUCKET --delete
          aws cloudfront create-invalidation --distribution-id $(npx cdk output --quiet UiStack.UiDistributionId) --paths '/*'
```

---

## 8) 運用タスク

- API鍵ローテーション
  - 新鍵を Secrets Manager に追加 → 古い鍵をしばらく併用 → ローテ完了後に削除
- 期限切れデータの自動削除
  - DDB: `expires_at`（TTL）により自動削除
  - S3: ライフサイクルで 365日後に削除
- 監視
  - SQS DLQ メッセージ数 > 0 で通知
  - Lambda エラー/タイムアウト増加の監視

---

## 9) トラブルシュートのヒント

-- UIがAPIに接続できない
  - `NEXT_PUBLIC_API_BASE_URL` が正しいか（`cdk output`のURL一致）
  - CORSのAllow OriginにCloudFrontドメインが含まれるか

-- ジョブが`queued`のまま
  - SQS → Worker Lambda のトリガーが有効か
  - Workerの実行ロールにDDB/S3の権限があるか

-- DDBサイズ上限エラー
  - `req_ref/result_ref` が S3 を指しているか（実体をDDBに入れていないか）
