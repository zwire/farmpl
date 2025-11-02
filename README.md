# FarmPL (Farm Planning) Engine

農業経営における営農計画の最適化を支援するWebアプリケーションです。作物の作付け計画、作業スケジュール、労働力配分、リソース管理を統合的に最適化し、収益性と効率性の高い栽培計画を自動生成します。

## Key Features

### 🎯 多目的最適化
- **段階的（レキシコ）最適化**：優先順位に基づいて複数の目的を順次最適化
- **実現可能性**：土地容量、労働力、リソース制約を満たす計画を自動生成
- **収益性**：作物の単価や面積を考慮した収益最大化
- **効率性**：土地の遊休時間や作業時間の最小化
- **多様性調整**：単一作物志向から多品目志向まで柔軟に対応

### 📊 包括的な制約管理
- **土地管理**：圃場ごとの面積、利用禁止期間、作物固定指定
- **労働力管理**：作業者の役割、作業時間上限、作業不可期間
- **リソース管理**：機械などの共有リソースの利用制約
- **イベント管理**：播種・定植・収穫などの実施条件（ウィンドウ/頻度/ラグ）
- **作付け制約**：作物ごとの面積上下限、土地占有期間の管理

### 🚀 高性能API
- **Google OR-Tools (CP-SAT)** による高速な最適化計算
- **同期/非同期実行**：小規模な計画は即座に、大規模な計画は非同期で処理
- **FastAPI**：型安全で高速なRESTful API
- **認証・認可**：API Key/Bearer Token による柔軟な認証
- **レート制限**：固定ウィンドウ方式によるAPI保護
- **メトリクス**：Prometheus互換のメトリクス出力
- **構造化ログ**：JSON形式の詳細なリクエストログ

### 🎨 直感的なUI
- **Next.js 15**：モダンなReactベースのフロントエンド
- **インタラクティブな計画作成**：圃場、作物、作業者、制約を視覚的に設定
- **作物テンプレート**：20種類以上の作物×作型のテンプレートから選択可能
- **リアルタイム計算**：最適化結果を即座に可視化
- **ダウンロード機能**：計画データのエクスポート

### ☁️ クラウドネイティブ
- **AWS Lambda**：サーバーレスデプロイによるスケーラブルな実行
- **AWS DynamoDB**：非同期ジョブの状態管理
- **CloudFront + S3**：静的コンテンツの高速配信
- **AWS CDK**：Infrastructure as Codeによる再現可能なデプロイ

## Setup

### 前提条件

- **Python 3.13+** および **uv**
- **Node.js 19+** および **npm**

### API サーバーのセットアップ

```bash
# 1. 依存関係のインストール
cd api
uv sync

# 2. テストの実行（オプション）
uv run pytest -q

# 3. 開発サーバーの起動
uv run uvicorn main:app --reload
```

APIサーバーは http://127.0.0.1:8000 で起動します。

#### 環境変数の設定（オプション）

```bash
# 認証設定（開発時は無効化可能）
export AUTH_MODE=none           # api_key, bearer, または none
export API_KEYS=devkey1,devkey2  # API Keyモード時

# レート制限
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_LIMIT=60      # 60リクエスト/分

# タイムアウト設定
export SYNC_TIMEOUT_MS=30000    # 同期API: 30秒
export ASYNC_TIMEOUT_S=1800     # 非同期ジョブ: 30分

# CORS設定
export CORS_ALLOW_ORIGINS=http://localhost:3000
```

### UI サーバーのセットアップ

```bash
# 1. 依存関係のインストール
cd ui
npm install

# 2. 開発サーバーの起動
npm run dev
```

UIは http://localhost:3000 で起動します。

#### UI環境変数の設定

```bash
# APIエンドポイント
export NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
export NEXT_PUBLIC_API_KEY=devkey1  # 必要に応じて
```

### 統合動作確認

```bash
# ルートディレクトリから便利スクリプトで起動
./dev.api.sh    # APIサーバー起動
./dev.ui.sh     # UIサーバー起動
```

両方のサーバーを起動後、ブラウザで http://localhost:3000 にアクセスして営農計画の作成を開始できます。

## プロジェクト構造

```
.
├── api/                    # バックエンドAPI（Python/FastAPI）
│   ├── lib/                # 最適化コアロジック
│   │   ├── planner.py      # メインプランナー
│   │   ├── solver.py       # OR-Tools CP-SAT ソルバー
│   │   ├── model_builder.py # 最適化モデル構築
│   │   ├── constraints/    # 各種制約の実装
│   │   └── schemas.py      # ドメインスキーマ
│   ├── routers/            # APIエンドポイント
│   │   ├── optimize.py     # 最適化API（同期/非同期）
│   │   ├── templates.py    # 作物テンプレートAPI
│   │   └── system.py       # ヘルスチェック等
│   ├── services/           # ビジネスロジック
│   │   ├── optimizer_adapter.py
│   │   ├── job_runner.py
│   │   └── templates_loader.py
│   ├── core/               # 共通機能
│   │   ├── auth.py         # 認証・認可
│   │   ├── rate_limit.py   # レート制限
│   │   ├── metrics.py      # Prometheusメトリクス
│   │   └── logging.py      # 構造化ログ
│   ├── templates/          # 作物テンプレート（TOML）
│   │   └── crops/          # 20種類以上の作物定義
│   ├── tests/              # 統合テスト（pytest）
│   └── docs/               # API設計ドキュメント
│
├── ui/                     # フロントエンド（Next.js 15）
│   ├── app/                # App Router
│   │   └── (planning)/     # 計画作成画面
│   ├── lib/                # ビジネスロジック
│   │   ├── domain/         # ドメインモデル
│   │   ├── state/          # 状態管理（Zustand）
│   │   └── validation/     # バリデーション
│   └── tests/              # フロントエンドテスト（Vitest）
│
├── infra/                  # インフラストラクチャ（AWS CDK）
│   ├── lib/
│   │   ├── infra-stack.ts  # API/Worker Lambdaスタック
│   │   ├── ui-stack.ts     # CloudFront + S3スタック
│   │   └── cicd-stack.ts   # CI/CDパイプライン
│   └── bin/
│
├── docs/                   # ドキュメント（MkDocs）
│   └── index.md
│
└── README.md               # このファイル
```

## 技術スタック

### バックエンド
- **Python 3.13**：最新のPython機能を活用
- **FastAPI**：高速で型安全なWebフレームワーク
- **Google OR-Tools**：組合せ最適化ライブラリ（CP-SATソルバー）
- **Pydantic v2**：データバリデーション
- **uvicorn**：ASGIサーバー
- **pytest**：テストフレームワーク
- **ruff**：高速リンター・フォーマッター

### フロントエンド
- **Next.js 15**：React フレームワーク（App Router）
- **TypeScript**：型安全な開発
- **Zustand**：軽量な状態管理
- **Tailwind CSS**：ユーティリティファーストCSS
- **Biome**：リンター・フォーマッター
- **Vitest**：高速なテストランナー

### インフラストラクチャ
- **AWS Lambda**：サーバーレス計算（API/Worker）
- **AWS DynamoDB**：NoSQLデータベース（ジョブ管理）
- **AWS S3 + CloudFront**：静的コンテンツ配信
- **AWS CDK（TypeScript）**：Infrastructure as Code
- **Docker**：Lambdaコンテナイメージ

## API エンドポイント

### 最適化API
- `POST /v1/optimize` - 同期最適化（30秒以内）
- `POST /v1/optimize/async` - 非同期最適化（長時間計算）
- `GET /v1/jobs/{job_id}` - ジョブ状態取得
- `DELETE /v1/jobs/{job_id}` - ジョブキャンセル

### テンプレートAPI
- `GET /v1/templates` - 作物テンプレート一覧
- `POST /v1/templates/instantiate` - テンプレート具体化

### システムAPI
- `GET /healthz` - ヘルスチェック
- `GET /readyz` - レディネスチェック
- `GET /metrics` - Prometheusメトリクス

詳細は [`api/README.md`](api/README.md) を参照してください。

## テスト

### バックエンドテスト

```bash
cd api
uv run pytest -v                    # 全テスト実行
uv run pytest tests/test_optimize_router_sync.py  # 特定テスト
uv run pytest -k "optimize"         # パターンマッチ
```

### フロントエンドテスト

```bash
cd ui
npm test                            # 全テスト実行
npm test -- --watch                 # ウォッチモード
```

## デプロイ

### AWS環境へのデプロイ

```bash
cd infra

# 初回のみ：CDK Bootstrap
npx cdk bootstrap

# スタックのデプロイ
npx cdk deploy --all

# 個別スタックのデプロイ
npx cdk deploy FarmPLInfraStack     # API/Worker Lambda
npx cdk deploy FarmPLUIStack        # CloudFront + S3
```

詳細は [`infra/README.md`](infra/README.md) および `deployment-manual-tasks.md` を参照してください。

## ドキュメント

- [`api/templates/README.md`](api/templates/README.md) - テンプレート追加方法

