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
  - `PUBLIC_API_KEY` = `PUBLIC_API_KEY` (任意の文字列。ただし後述のSecretsManagerと合わせる。)

Secrets は基本不要（OIDCを利用するためアクセスキーは不要）。

---

## 5) API鍵（本番認可）の投入（Secrets Manager）

CDKで `ApiKeysSecretArn`（空）が作られます。以下のように値を設定します（複数可）。

```bash
aws secretsmanager put-secret-value \
  --secret-id ApiKeysSecretArn \
  --secret-string '{"keys": ["PUBLIC_API_KEY"]}'
```

Lambda は起動時にこのシークレットを読み取り、`AUTH_MODE=api_key` の場合のみ検証します。

---

## 6) GitHub Actions での自動デプロイ

`main` へ push すると以下の流れで動きます（ワークフローは実装側で追加）。

1. OIDCで `AWS_ROLE_TO_ASSUME` をAssume
2. `cdk deploy` で `InfraStack`/`UiStack` を更新
3. `cdk output` から `ApiBaseUrl` を取得し、`NEXT_PUBLIC_API_BASE_URL` として `ui/` をビルド
4. `aws s3 sync ui/out s3://<UiBucket>` し、`cloudfront create-invalidation --paths '/*'`

---

## 7) 運用タスク

- API鍵ローテーション
  - 新鍵を Secrets Manager に追加 → 古い鍵をしばらく併用 → ローテ完了後に削除
- 期限切れデータの自動削除
  - DDB: `expires_at`（TTL）により自動削除
  - S3: ライフサイクルで 365日後に削除
- 監視
  - SQS DLQ メッセージ数 > 0 で通知
  - Lambda エラー/タイムアウト増加の監視
