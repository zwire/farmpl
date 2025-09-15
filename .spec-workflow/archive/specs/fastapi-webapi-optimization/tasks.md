# Tasks Document

- [x] 1. FastAPIアプリのスキャフォールド
  - File: `api/app.py`; `api/main.py`
  - `create_app()`（CORS・ミドルウェア・ルータ登録・バージョンプレフィックス）を実装し、`main.py` で Uvicorn 起動エントリを公開。
  - _Leverage: `.cursor/rules/project-structure.mdc` の推奨（`api/main.py`）、`api/pyproject.toml`_
  - _Requirements: R1, R4, NFR-Architecture_
  - _Prompt: Role: Python Backend Engineer (FastAPI) | Task: `api/` 配下にアプリファクトリと ASGI エントリを作成し `/v1` 配下にエンドポイントを集約、ログ/メトリクスのプレースホルダも用意 | Restrictions: 依存は最小、`.cursor` 構成に従う | Success: `uvicorn api.main:app` で `/healthz` が 200、未定義ルートは 404_

- [x] 2. 最適化用スキーマ定義
  - File: `api/schemas/optimization.py`
  - `OptimizationRequest`、`OptimizationResult`、`JobInfo` の Pydantic モデルを作成。
  - _Leverage: `api/docs/model.md`, requirements の Data Models_
  - _Requirements: R1, R2_
  - _Prompt: Role: Python Developer (Pydantic v2) | Task: 仕様どおりのDTOを型・説明・例付きで作成 | Restrictions: v2 準拠、余剰フィールド禁止 | Success: OpenAPI にモデルが表示され、無効入力は 422_

- [x] 3. オプティマイザアダプタ実装
  - File: `api/services/optimizer_adapter.py`
  - DTO→ドメイン変換を行い `api/lib/solver.py` を呼び出し、結果を正規化して返却。
  - _Leverage: `api/lib/solver.py`, `api/lib/objectives.py`, `api/lib/constraints/*`_
  - _Requirements: R3_
  - _Prompt: Role: Optimization Engineer (OR-Tools) | Task: 同期 solve を安全にラップし、エラー変換と計測情報（時間等）を付与 | Restrictions: ドメイン実装は変更しない | Success: 目的値・解・統計を備えた `OptimizationResult` を返却_

- [x] 4. 運用系ルータ追加
  - File: `api/routers/system.py`
  - エンドポイント: `GET /healthz`, `GET /readyz`, `GET /metrics`（Prometheus エクスポート）。
  - _Leverage: `prometheus_client`_
  - _Requirements: R4, NFR-Reliability_
  - _Prompt: Role: SRE-minded Backend Engineer | Task: 軽量なヘルス/レディネスとメトリクス公開を実装 | Restrictions: 機密情報は返さない | Success: `/healthz` 200、`/readyz` が依存チェック、`/metrics` がカウンタ出力_

- [x] 5. 最適化ルータ（同期/非同期）
  - File: `api/routers/optimize.py`
  - エンドポイント: `POST /v1/optimize`（同期）、`POST /v1/optimize/async`、`GET /v1/jobs/{job_id}`、`DELETE /v1/jobs/{job_id}`。
  - _Leverage: `api/schemas/optimization.py`, `services.optimizer_adapter`, `services.job_runner`_
  - _Requirements: R1, R2, R5.2（429の扱い）_
  - _Prompt: Role: API Engineer (FastAPI) | Task: バリデーション、タイムアウト、エラー変換、冪等性キー（またはヘッダ）対応 | Restrictions: ハンドラは薄く、処理はサービスへ委譲 | Success: 受け入れ基準どおりに全APIが応答_

- [x] 6. ジョブ実行基盤（インメモリ）
  - File: `api/services/job_runner.py`
  - `enqueue`/`get`/`cancel` を提供し、`ThreadPoolExecutor` とインメモリ辞書で状態管理。
  - _Leverage: `concurrent.futures`, `uuid`, `time`_
  - _Requirements: R2, NFR-Reliability_
  - _Prompt: Role: Python Concurrency Dev | Task: 進捗とキャンセルを備える最小実装 | Restrictions: 外部依存なし、シャットダウン安全 | Success: 単一プロセス内で非同期フローが機能_

- [x] 7. JobBackend プロトコル定義
  - File: `api/services/job_backend.py`
  - プロトコル/ABC を定義し、将来の `Redis + RQ/Celery` 用スタブを用意。
  - _Leverage: `typing.Protocol`_
  - _Requirements: NFR-Architecture, Scalability_
  - _Prompt: Role: Software Architect | Task: 交換可能なジョブバックエンドIFの設計 | Restrictions: ここでは外部通信なし | Success: 型チェック通過、ランナーがIFに依存可能_

- [x] 8. 認可依存の実装
  - File: `api/core/auth.py`
  - API Key または Bearer Token を設定駆動で強制する依存関数。
  - _Leverage: `fastapi.security`, `core.config`_
  - _Requirements: R5.1_
  - _Prompt: Role: Security-minded Backend Engineer | Task: ヘッダ検証と 401/403 応答、テストダブルを実装 | Restrictions: 秘密はリポジトリに置かない | Success: 保護エンドポイントが不正トークンを拒否_

- [x] 9. エラー集約と問題詳細
  - File: `api/core/errors.py`
  - ドメイン/検証/タイムアウトをHTTPへ一元マッピング。共通JSON形を提供。
  - _Leverage: FastAPI の例外ハンドラ_
  - _Requirements: R1.2, R3.2, NFR-Security_
  - _Prompt: Role: Backend Engineer | Task: 例外ハンドラと再利用可能なエラーモデルを用意 | Restrictions: レスポンスにスタックトレースを含めない | Success: 既知エラーが一貫した形で返る_

- [x] 10. メトリクスと構造化ログ
  - File: `api/core/metrics.py`; `api/core/logging.py`
  - Prometheus カウンタ/ヒストグラム、相関ID付き構造化ログを実装。
  - _Leverage: `prometheus_client`, `logging`, `contextvars`_
  - _Requirements: R4.1_
  - _Prompt: Role: Observability Engineer | Task: ルート別リクエスト/レイテンシ、ジョブ時間の計測 | Restrictions: 高カーディナリティ回避 | Success: `/metrics` に件数/レイテンシが出力、ログに `request_id`_

- [x] 11. 設定管理
  - File: `api/core/config.py`
  - 環境変数主導の設定: `API_KEYS`, `AUTH_MODE`, `MAX_JSON_MB`, `SYNC_TIMEOUT_MS`, `ASYNC_TIMEOUT_S`, `JOB_BACKEND`, `REDIS_URL` ほか。
  - _Leverage: `pydantic-settings` または `os.environ`_
  - _Requirements: NFR-Security, Performance_
  - _Prompt: Role: Python Engineer | Task: 既定値と検証を備えた設定クラス | Restrictions: ハードコード秘密禁止 | Success: ENV 有無で起動し、無効値は早期に検出_

- [x] 12. レート制限フック（スタブ）
  - File: `api/core/rate_limit.py`
  - インターフェースと no-op 実装、ミドルウェア差し込みポイントを提供。
  - _Leverage: Starlette ミドルウェア_
  - _Requirements: R5.2_
  - _Prompt: Role: Backend Engineer | Task: 設定で有効化し 429 を返せるフック | Restrictions: 既定は無効 | Success: 設定ONで閾値超過時に 429_

- [x] 13. ルータ/ミドルウェアの全体配線
  - File: `api/app.py`（更新）
  - すべてのルータ、認可依存、エラーハンドラ、メトリクスを組み込み。
  - _Leverage: 上記コンポーネント_
  - _Requirements: 全般_
  - _Prompt: Role: FastAPI Integrator | Task: アプリファクトリに順序（logging→rate-limit→routes→errors）で組込 | Restrictions: 順序を崩さない | Success: 起動が安定し OpenAPI に全エンドポイント表示_

- [x] 14. ユニットテスト: スキーマとアダプタ
  - File: `api/tests/test_schemas.py`; `api/tests/test_optimizer_adapter.py`
  - DTO ルール検証、アダプタの正常/例外パスをテスト。
  - _Leverage: pytest, fixtures_
  - _Requirements: R1, R3_
  - _Prompt: Role: QA (Python) | Task: 無効フィールドとドメイン例外のマッピングを含むテスト | Restrictions: 外部サービス依存なし | Success: 主要エッジケースを含めテスト合格_

- [x] 15. APIテスト: 同期エンドポイント
  - File: `api/tests/test_optimize_sync.py`
  - 200/422/タイムアウト/認可必須を検証。
  - _Leverage: `fastapi.testclient`_
  - _Requirements: R1, R5_
  - _Prompt: Role: QA (API) | Task: `/v1/optimize` の統合テスト | Restrictions: 小規模インスタンスで実行 | Success: 期待応答がすべて緑_

- [x] 16. APIテスト: 非同期フロー
  - File: `api/tests/test_optimize_async.py`
  - enqueue→poll→complete/failed/canceled を網羅。
  - _Leverage: `fastapi.testclient`, `monkeypatch`_
  - _Requirements: R2_
  - _Prompt: Role: QA (API) | Task: 成功/失敗/キャンセルパスの再現性あるテスト | Restrictions: フェイクで時間制御 | Success: 安定して合格_

- [x] 17. 運用系エンドポイントのテスト
  - File: `api/tests/test_system_endpoints.py`
  - healthz/readyz/metrics の挙動を確認。
  - _Leverage: testclient_
  - _Requirements: R4_
  - _Prompt: Role: QA (SRE) | Task: 200 とコンテンツタイプ等の基本確認 | Restrictions: 重い検証は避ける | Success: 基本アサーションが通る_

- [x] 18. セキュリティテスト
  - File: `api/tests/test_auth.py`
  - 保護エンドポイントでの API Key/Bearer 強制を検証。
  - _Leverage: `core.auth`, testclient_
  - _Requirements: R5_
  - _Prompt: Role: QA (Security) | Task: 401/403 と正常系の検証 | Restrictions: 実トークンは使用しない | Success: すべての経路を検証_

- [x] 19. 開発者ドキュメント更新
  - File: `api/README.md`（更新）
  - 使い方、環境変数、起動/テスト手順、curl サンプルを記載。
  - _Leverage: requirements/design docs_
  - _Requirements: Usability_
  - _Prompt: Role: Tech Writer | Task: セットアップと例を簡潔に記述 | Restrictions: 冗長にしない | Success: 初見でも起動・API呼び出し可能_

- [x] 20. Graceful shutdown とタイムアウト
  - File: `api/app.py`; `services/job_runner.py`
  - ライフスパンイベントでジョブのフラッシュ/キャンセル、同期タイムアウトの強制を実装。
  - _Leverage: FastAPI lifespan context_
  - _Requirements: Reliability, Performance_
  - _Prompt: Role: Backend Engineer | Task: シャットダウンフックと同期タイムアウトを実装 | Restrictions: 終了処理でブロックしない | Success: ハングなし、タイムアウトが尊重される_
