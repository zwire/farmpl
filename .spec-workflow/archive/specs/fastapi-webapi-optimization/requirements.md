# Requirements Document

## Introduction

本仕様は、既存の最適化（数理最適化/ヒューリスティック/メタヒューリスティック等）コードをWeb APIとして提供するために、FastAPIを導入し、社内/外部クライアントからの同期・非同期リクエストを安全かつ高性能に受け付けられるエンドポイントを定義する。最小の変更で既存ロジックをサービス化し、将来的なスケールアウトやバッチ/キュー処理への拡張を見据える。

## Alignment with Product Vision

- APIファーストの方針に沿い、最適化エンジンをマイクロサービス化して再利用性を高める。
- 計算リソースの集約と監視を可能にし、SLA/可観測性の向上を図る。
- クライアント（Web/バッチ/ETL/ノートブック）から同一のAPI契約で呼び出し可能とする。

## Requirements

### Requirement 1

**User Story:** 最適化の利用者として、入力データ（パラメータ/制約/目的）を送信すると、最適化結果（解、評価値、メタ情報）をJSONで取得したい。これにより、他システムからの自動連携が可能になる。

#### Acceptance Criteria

1. WHEN クライアントが`POST /optimize`に有効なJSONスキーマの入力を送信 THEN システム SHALL 最適化を実行し、HTTP 200で結果JSON（目的関数値、解ベクトル/割当、ステータス、計算時間）を返す。
2. IF 入力検証に失敗 THEN システム SHALL HTTP 422とバリデーションエラーの詳細（フィールド、理由、期待値）を返す。
3. WHEN 計算がタイムアウト閾値を超過 AND キャンセル許可が無効 THEN システム SHALL 部分的なベスト解と`status=timeout`を返す。

### Requirement 2

**User Story:** バックグラウンド実行が必要な大規模最適化の依頼者として、非同期ジョブを投入し、後から結果を取得/ポーリングしたい。これにより、長時間処理でHTTPタイムアウトを避けられる。

#### Acceptance Criteria

1. WHEN `POST /optimize/async`にジョブ要求を送信 THEN システム SHALL HTTP 202で`job_id`とステータス取得URLを返す。
2. WHEN `GET /jobs/{job_id}`を呼び出し THEN システム SHALL `pending|running|succeeded|failed|timeout|canceled`のいずれかの状態と進捗、結果（完了時）またはエラーメッセージ（失敗時）を返す。
3. WHEN `DELETE /jobs/{job_id}`を呼び出し AND ジョブが`pending|running` THEN システム SHALL キャンセル要求を受理し、可能な場合は計算を中断する。

### Requirement 3

**User Story:** 開発者として、既存の最適化モジュールを最小変更でAPIに組み込みたい。これにより、保守性を確保しつつ移行コストを抑えたい。

#### Acceptance Criteria

1. WHEN 既存最適化関数（例：`solve(params: dict) -> Result`）をラップ THEN システム SHALL ドメイン層とAPI層を分離し、I/O変換はアダプタで実装する。
2. IF ロジック例外が発生 THEN システム SHALL ドメイン固有エラーをHTTPステータス/エラーコードにマッピングする。

### Requirement 4

**User Story:** SRE/運用者として、APIの動作を観測し、問題を早期検知したい。

#### Acceptance Criteria

1. WHEN リクエスト処理 THEN システム SHALL 構造化ログ（相関ID、処理時間、結果ステータス、エラー詳細）を出力する。
2. WHEN /metricsにアクセス THEN システム SHALL Prometheus互換メトリクス（リクエスト数、レイテンシ、エラー率、ジョブ実行時間分布）を公開する（必要に応じて保護）。

### Requirement 5

**User Story:** セキュリティ担当として、APIを認可制御下に置き、入力を安全に扱いたい。

#### Acceptance Criteria

1. WHEN 保護対象エンドポイントにアクセス THEN システム SHALL OAuth2（Bearerトークン）での認可を要求する。
2. IF レート制限を超過 THEN システム SHALL HTTP 429で応答する（同期/非同期で同等の挙動）。
3. WHEN 受信JSONを処理 THEN システム SHALL スキーマバリデーションと境界チェックを実施し、危険な入力を拒否する。

## Non-Functional Requirements

### Code Architecture and Modularity
- Single Responsibility Principle: API層、アダプタ層、ドメイン（最適化）層、インフラ層（キュー/DB/キャッシュ）を分離。
- Modular Design: 入出力スキーマはPydanticモデルで定義、ドメインとの変換を明示。
- Dependency Management: 最小限の依存に限定（FastAPI、Pydantic、Uvicorn）。
- Clear Interfaces: `OptimizerPort`インターフェースを定義し、既存実装を適合させる。

### Performance
- 同期APIはP95レイテンシ≤2s（軽量ケース、計算時間除く）を目標。
- 非同期ジョブはキュー待ち+実行の合計SLOを設定（例：P90≤30分）。
- モデル/JSONシリアライズのオーバーヘッドを最小化（不要なネスト/重複排除）。

### Security
- 認可方式（Bearer Token）の強制。
- 入力サイズ上限（例：JSON 5MB）とタイムアウト/同時実行数のガード。
- エラーメッセージから内部実装を漏えいしない（スタックトレース非公開）。

### Reliability
- 健康診断`GET /healthz`と依存先チェック`GET /readyz`を提供。
- 失敗時の再試行ポリシー（非同期ジョブ）と冪等性キー（重複投入防止）。
- シャットダウンフックで計算の安全停止/保存を行う。

### Usability
- OpenAPIスキーマ/Swagger UIを自動生成し、サンプルリクエスト/レスポンスを提供。
- エラーカタログとサンプルコード（Python/JS）をドキュメント化。