# Schemas & Adapter Explanations

## Summary
- Purpose: Tighten API validation using Pydantic, normalize domain units, and add a Gantt-friendly timeline to optimization results.
- Scope: `api/schemas/optimization.py` (strict API models + timeline) and `api/services/optimizer_adapter.py` (conversion + planner call + timeline build).

## Files Touched
- `api/schemas/optimization.py`
  - Request/Response models: `OptimizationRequest`, `OptimizationResult` (+ `timeline`), `JobInfo`。
  - Strict API input models: `ApiPlan`, `ApiHorizon`, `ApiCrop`, `ApiEvent`, `ApiLand`, `ApiWorker`, `ApiResource`, `ApiCropAreaBound`, `ApiFixedArea`, `ApiPreferences`, `OptimizationStagesConfig`。
  - Timeline models: `OptimizationTimeline`, `GanttLandSpan`, `GanttEventItem`。
- `api/services/optimizer_adapter.py`
  - Public: `solve_sync`, `to_domain_plan`。
- Tests
  - `api/tests/test_schemas.py`
  - `api/tests/test_optimizer_adapter.py`
  - `api/tests/test_optimize_router_sync.py`
  - `api/tests/test_optimize_async.py`
  - `api/tests/test_system_endpoints.py`

## Router (Task 5)
- 追加: `api/routers/optimize.py`
  - `POST /v1/optimize`（同期）: `OptimizationRequest` を受け取り `services.solve_sync` を実行して `OptimizationResult` を返却。
  - ヘッダ `Idempotency-Key` / `X-Idempotency-Key` が本文に無い場合は補完。
  - `POST /v1/optimize/async` / `GET /v1/jobs/{job_id}` / `DELETE /v1/jobs/{job_id}` は Task 6 で有効化予定のため、現時点は 501（Not Implemented）。
- 変更: `api/app.py` で `optimize` ルータを `include_router`。
- テスト: `api/tests/test_optimize_router_sync.py` は TestClient で `/v1/optimize` を実呼び出し。`services.optimizer_adapter.run_plan` を monkeypatch して高速化。

## Async Jobs (Task 6)
- 追加: `api/services/job_runner.py`（ThreadPoolExecutor + メモリストア）
- 変更: `api/routers/optimize.py`（/optimize/async, /jobs/* を job_runner に接続）
- 変更: `api/app.py`（lifespanでshutdown時にjob_runnerを停止）
- テスト: `api/tests/test_optimize_async.py`（solve_syncをモックしてHappy Path）

## Job Backend (Task 7)
- 追加: `api/services/job_backend.py`
  - `JobBackend` プロトコル（`enqueue/get/cancel/shutdown`）
  - 既定実装 `InMemoryJobBackend`（ThreadPoolExecutor + メモリ管理）
- 変更: `api/services/job_runner.py`
  - バックエンド委譲にリファクタ（`_backend: JobBackend = InMemoryJobBackend()`）
  - 公開API（`enqueue/get/cancel/shutdown`）は維持
- 目的: 今後の `Redis/RQ/Celery` 等への差し替えを容易化

## Timeouts & Shutdown (Task 20)
- 同期タイムアウト
  - 追加: `services.optimizer_adapter.solve_sync_with_timeout(req, timeout_ms)`（スレッド + タイムアウト）
  - 変更: `routers/optimize.optimize_sync` が `SYNC_TIMEOUT_MS` を読み、タイムアウトを適用
- シャットダウン（補足）
  - lifespan で `services.job_runner.shutdown()` を呼び、実行中ジョブをキャンセルして停止
- テスト
  - `api/tests/test_sync_timeout.py` で `status=timeout` を検証

## Ops Endpoints (Task 4)
- 追加: `api/core/metrics.py`（Prometheusなしでも安全なフォールバック）
- 追加: `api/routers/system.py`（`/readyz`, `/metrics`）
- 変更: `api/app.py` に system ルータを組み込み
- テスト: `api/tests/test_system_endpoints.py`

## API Schemas

### OptimizationRequest
- Fields
  - `idempotency_key: str | None`
  - `plan: ApiPlan | None`（推奨）
  - `params: dict | None`（互換・非推奨）
  - `timeout_ms: int | None`, `priority: int | None`
- Validation
  - `plan` または `params` のどちらか必須（`plan`がある場合はそちらを優先）。

### Strict API Models（ApiPlan 配下）
- `ApiHorizon`: `num_days > 0`。
- `ApiCrop`: 価格は `price_per_a`（円/a）または`price_per_10a`（円/10a）の片方のみ。`normalized_price_per_a()` を提供。
- `ApiLand`: 面積は `area_a` または `area_10a` の片方のみ。`normalized_area_a()` を提供。
- `ApiEvent`:
  - `lag_min_days <= lag_max_days` を強制（指定時）。
  - `uses_land=True` → `occupancy_effect ∈ {start,hold,end}`／`False` → `None|"none"`。
- `ApiCropAreaBound`: `min_area ≤ max_area`（単位正規化の上で検証）。
- `ApiPreferences`: 重みは非負。
- `OptimizationStagesConfig`
  - `stage_order: list[str]`（デフォルト: `profit, labor, idle, dispersion, peak, diversity`）
  - `tolerance_by_stage`, `step_tolerance_by` の各値は `0..1`。

### Cross-Model Validations（ApiPlan）
- 参照整合性: `events[].crop_id` が `crops[].id` に存在すること。
- 作物イベント存在性: 各作物に少なくとも1件の関連イベントが必要（なければエラー）。
- 先行イベント参照: `preceding_event_id` は存在必須かつ同一作物内。
- 期間境界: `blocked_days ⊆ [0 .. num_days-1]`。

### OptimizationResult（出力）
- 互換: 既存フィールドは維持（`status`, `objective_value`, `solution`, `stats`, `warnings`）。
- 追加: `timeline: OptimizationTimeline | None`（任意）。

### Timeline（Gantt）
- `GanttLandSpan`（長尺バー）: `land_id`, `crop_id`, `start_day`, `end_day`（包含）, `area_a`。
- `GanttEventItem`（日次イベント）: `day`, `event_id`, `crop_id`, `land_id?`, `worker_ids[]`, `resource_ids[]`。
- `OptimizationTimeline`: `land_spans[]`, `events[]`。

## Adapter（optimizer_adapter）

### Responsibilities
- API入力（`ApiPlan`）をドメイン（`lib.schemas.PlanRequest`）に正規化して渡す。
- `lib.planner.plan(...)` の結果を `OptimizationResult` に変換。
- `PlanResponse` から `OptimizationTimeline` を構築。

### Conversions（単位・構造）
- 面積: `10a` → `a`、価格: `円/10a` → `円/a`。
- `Api*` → `lib.schemas.*` の1:1マッピング（役割/資源/ブロック日などを透過）。
- 作付け境界/固定面積: それぞれ `CropAreaBound` / `FixedArea` に正規化。
- Preferences: 重みをそのまま橋渡し。

### Planner Invocation
- `stage_order` と `step_tolerance_by` を `plan(..., stage_order=..., lock_tolerance_by=...)` へ委譲。
- `params` 経路は現状エラー応答（移行促進のため）。

### Timeline Construction
- 連続区間のマージ
  - 入力: `assignment.crop_area_by_land_day: land -> day -> crop -> area[a]`。
  - 同一 `land_id`・`crop_id` で「面積が同じ」かつ「連続日」を1本の `GanttLandSpan` に統合。
- イベント
  - `event_assignments` を `GanttEventItem` に変換。
  - `worker_ids` / `resource_ids` をIDで格納（`land_id`は現状得られないため `None`）。

## Testing
- `api/tests/test_schemas.py`
  - 余剰フィールド禁止、デフォルト、進捗境界（`JobInfo`）。
  - 作物イベント必須、面積単位排他、`blocked_days` 範囲、先行イベントの存在と同一作物性。
- `api/tests/test_optimizer_adapter.py`
  - 単位正規化の検証（`1[10a] -> 10[a]`、`100000[円/10a] -> 10000[円/a]`）。
  - `plan` をモンキーパッチし、3日連続の作付けが1本の `GanttLandSpan` にマージされること、`OptimizationTimeline` が生成されることを確認。
- `api/tests/test_optimize_router_sync.py`
  - TestClient で `/v1/optimize` を実行し 200/`status=ok` を確認（planner をモック）。

## Error & Compatibility Policy
- 入力検証: Pydantic の `ValidationError` を FastAPI で 422 JSON として返却予定（ルータ実装時にハンドラで整形）。
- 互換: 旧 `params` は現状エラー返却（移行完了後に削除予定）。
- 将来拡張: `GanttEventItem` の `land_id` 補完、面積の細粒度変化に対するマージ戦略設定、ステージ/段の許容率の詳細反映。

