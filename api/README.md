# FarmPL API ドキュメント

## 概要
----
- 既存の最適化（OR-Tools ベース）を Web API 化したサービス。
- 同期/非同期実行、認可、レート制限、タイムアウト、メトリクス、構造化ログを備えた最小実装。

## クイックスタート
----------------
1) 依存の同期
```bash
uv sync
```

2) テスト
```bash
cd api
uv run pytest -q
```

3) サーバ起動（開発）
```bash
cd api
uv run uvicorn main:app --reload
```

## 主要エンドポイント
- `POST /v1/optimize`（同期）: OptimizationRequest → OptimizationResult
- `POST /v1/optimize/async`（非同期投入）: 202 Accepted → JobInfo{job_id}
- `GET /v1/jobs/{job_id}`（状態/結果）
- `DELETE /v1/jobs/{job_id}`（キャンセル）
- `GET /healthz`（ヘルス） / `GET /readyz`（依存チェック） / `GET /metrics`（Prometheus 互換）

## 環境変数（主要）
- 認可（既定: API Key 必須）
  - `AUTH_MODE` = `api_key` | `bearer` | `none`（既定: `api_key`）
  - `API_KEYS` = `devkey1,devkey2`
  - `BEARER_TOKENS` = `token1,token2`

- レート制限（固定ウィンドウ）
  - `RATE_LIMIT_ENABLED` = `true|false`（既定: `false`）
  - `RATE_LIMIT_WINDOW_S` = ウィンドウ秒（既定: `60`）
  - `RATE_LIMIT_LIMIT` = 上限回数（既定: `60`）
  - `RATE_LIMIT_KEY_MODE` = `ip` | `api_key`（既定: `ip`）

- タイムアウト/サイズ
  - `SYNC_TIMEOUT_MS`（同期API、既定: `30000`）
  - `ASYNC_TIMEOUT_S`（非同期ジョブ、既定: `1800`）
  - `MAX_JSON_MB`（受信JSONサイズ目安、既定: `2`）

- ジョブ実行基盤（将来拡張）
  - `JOB_BACKEND`（既定: `inmemory`）
  - `REDIS_URL`（分散バックエンド利用時）

- CORS
  - `CORS_ALLOW_ORIGINS`（カンマ区切り。既定: `*`）

## 認可の使い方
- API Key: `X-API-Key: <key>` または `Authorization: ApiKey <key>`
- Bearer:  `Authorization: Bearer <token>`
- 無効化:  `AUTH_MODE=none`（開発用途）

## レート制限の挙動
- 有効時は固定ウィンドウでカウント。
- 超過時: HTTP 429  JSON `{ status, title, detail, retry_after }`
- 付与ヘッダ: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`

## 同期タイムアウト
- `SYNC_TIMEOUT_MS` 超過で `OptimizationResult{ status: "timeout" }` を返却。
- `objective_value = null`、`stats.timeout_ms` に設定値を格納。

## エラーレスポンス（Problem-like）
- 422（Request/Pydantic Validation）: `{ status, title, detail, errors: [...] }`
- Domain/HTTP/500 も一貫したJSONで返却（スタックは非公開）

## ログ/メトリクス
- 構造化ログ（JSON行）: `request.start` / `request.end`（method, path, status, duration_ms, request_id）
- 全レスポンスに `X-Request-ID` を付与。
- Prometheus メトリクス:
  - `http_requests_total{method,path,status}`
  - `http_request_duration_seconds_bucket{method,path,...}` ほか

## デモCLI（ライブラリ直呼び）
```bash
cd api
uv run python demo_lib.py plan
uv run python demo_lib.py compare --stages profit,dispersion
```

## デモCLI（HTTPでAPI呼び出し）
```bash
# 1) サーバ起動（別シェル）
cd api
API_KEYS=devkey1 uv run uvicorn main:app --reload

# 2) 同期最適化（API Key を使う場合）
API_BASE_URL=http://127.0.0.1:8000 API_KEY=devkey1 uv run python demo_api.py sync

# 3) 非同期最適化
API_BASE_URL=http://127.0.0.1:8000 API_KEY=devkey1 uv run python demo_api.py async --poll 0.5

# 4) JSON 出力
uv run python demo_api.py sync --json
```

## curl の例
```bash
curl -sS -H 'Content-Type: application/json' -H 'X-API-Key: devkey1' \
  -XPOST http://127.0.0.1:8000/v1/optimize \
  -d '{"plan": {"horizon": {"num_days": 7}, "crops": [], "events": [], "lands": [], "workers": [], "resources": []}}'
```

## トラブルシューティング
- 401 Unauthorized: `AUTH_MODE` と `API_KEYS/BEARER_TOKENS` を設定。
- 429 Too Many Requests: `RATE_LIMIT_*` と `RATE_LIMIT_KEY_MODE` を確認。
- 422 Validation Error: `errors` の内容に従って `ApiPlan` を修正。
- 同期で `status=timeout`: `SYNC_TIMEOUT_MS` を調整。重いケースは非同期API利用を検討。

## 参照
- API 入出力モデル: `api/schemas/optimization.py`
- ドメインスキーマ: `api/lib/schemas.py`
