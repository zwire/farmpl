# Tasks Document (metrics-enhancements)

Purpose: Ship day/decade timelines for Workers and Lands without schema versions, without over/highlight/export, and without re-optimizing. The API aggregates from job_backend snapshots; UI renders simple timelines + summaries.

Assumptions and constraints
- Bucket is computed on day indices (0-based). Decade = U:0–9, M:10–19, L:20–29 within each 30-day window starting from day 0. Calendar dates can be added later if/when a base date is introduced.
- Aggregation uses the plan (capacities/areas) and the optimization timeline (events + land spans). No DB; everything is in-memory from job_backend.
- Backward compatibility is not required for this feature.
- Use `uv run` when executing python.

- [x] 0. Repo pre-checks and conventions
  - Confirm files exist:
    - `api/services/job_backend.py`, `api/services/job_runner.py`
    - `api/schemas/optimization.py`, `api/main.py`
    - `ui/app/(planning)/components/metrics/MetricsCharts.tsx`
  - Python/TS style per `.cursor/rules/*`.
  - Tests: `pytest` for API, `vitest` for UI.

- [x] 1. Add metrics schemas (no version/over)
  - File: `api/schemas/metrics.py` (NEW)
  - Add Pydantic models exactly as below:
    - `EventMetric`: `id:str`, `label:str`, `start_day:int`, `end_day:int | None`, `type:str | None`
    - `WorkerMetric`: `worker_id:str`, `name:str`, `utilization:float`, `capacity:float`
    - `LandMetric`: `land_id:str`, `name:str`, `utilization:float`, `capacity:float`
    - `DaySummary`: `labor_total_hours:float`, `labor_capacity_hours:float`, `land_total_area:float`, `land_capacity_area:float`
    - `DayRecord`: `interval:Literal['day','decade']`, `day_index:int | None`, `period_key:str | None`, `events:list[EventMetric]`, `workers:list[WorkerMetric]`, `lands:list[LandMetric]`, `summary:DaySummary`
    - `TimelineResponse`: `interval:Literal['day','decade']`, `records:list[DayRecord]`
  - Import surface: export all models via `__all__`.
  - Acceptance
    - `from api.schemas.metrics import DayRecord, TimelineResponse` succeeds.
    - Lint/type-check passes.

- [x] 2. Expose job snapshots (request + result) from backend
  - File: `api/services/job_backend.py` (UPDATE)
  - Add a read-only snapshot model:
    - `class JobSnapshot(BaseModel): job: JobInfo; req: OptimizationRequest | None; result: OptimizationResult | None`
  - Extend `JobBackend` protocol with: `def snapshot(self, job_id: str) -> JobSnapshot: ...`
  - Implement in `InMemoryJobBackend`:
    - Return `JobSnapshot(job=self._to_model(job_id, st), req=st.req, result=st.result)`
    - Raise `KeyError` if not found.
  - File: `api/services/job_runner.py` (UPDATE)
    - Add `def snapshot(job_id: str) -> JobSnapshot: return _backend.snapshot(job_id)`
  - Acceptance
    - Enqueue → complete → `snapshot(id)` returns both `req` and `result`.

- [x] 3. Metrics aggregator service (job_backend-based)
  - File: `api/services/metrics_aggregator.py` (NEW)
  - Public API (exact signatures):
    - `def aggregate(job_id: str, start_day: int, end_day: int, bucket: Literal['day','decade']) -> TimelineResponse:`
  - Internal helpers (pure functions):
    - `_decade_key(day: int) -> str`  // month_index = day // 30; label = 'U' if d%30<10 else 'M' if <20 else 'L'; return f"{month_index:03d}:{label}"
    - `_validate_range(plan_days:int, start_day:int, end_day:int)` // raise if out of range or start>end
  - Algorithm (exact):
    1) `snap = job_runner.snapshot(job_id)`; require `snap.result` and `snap.req` and `snap.result.status=='ok'`.
    2) `plan = snap.req.plan` lookups:
       - `workers_by = {w.id: w for w in plan.workers}`
       - `lands_by = {l.id: l for l in plan.lands}`; `land_cap = {id: l.normalized_area_a()}`
       - `events_by = {e.id: e for e in plan.events}` (use `labor_total_per_a`)
    3) Accumulators per day in `[start_day, end_day]`:
       - `labor_used_by_worker_day[wid][d] = 0.0`
       - `labor_cap_by_worker_day[wid][d] = workers_by[wid].capacity_per_day`
       - `land_used_by_land_day[lid][d] = 0.0`
    4) Land utilization (from `timeline.land_spans`) for each day intersection add `span.area_a`.
    5) Labor utilization (from `timeline.events`) per event day:
       - `meta = events_by.get(ev.event_id)`; `area_a = sum(lands_by[x].normalized_area_a() for x in ev.land_ids if x in lands_by)`
       - `labor_total = (meta.labor_total_per_a or 0.0) * area_a`
       - If `ev.worker_ids`: split equally among them `share = labor_total / len(ev.worker_ids)` and accumulate to `labor_used_by_worker_day[w][ev.day]`.
    6) Build DayRecord(s):
       - bucket `day`: for each day create `DayRecord(interval='day', day_index=d, period_key=None, events=[...], workers=[...], lands=[...], summary=...)`.
       - bucket `decade`: group days by `_decade_key(d)` and sum; set `interval='decade'`, `day_index=None`, `period_key=key`.
  - Acceptance
    - Deterministic totals for day/decade in unit tests.
    - Handles empty/missing ids without raising.

- [x] 4. FastAPI router for metrics timeline
  - File: `api/routers/metrics.py` (NEW)
  - Endpoint
    - `GET /metrics/timeline`
    - Query: `job_id:str`, `start_day:int`, `end_day:int`, `bucket:str in {'day','decade'}`
  - Behavior
    - 400 on invalid bucket; 422 on invalid ranges; 404 on unknown job.
    - Return `TimelineResponse` (from `api.schemas.metrics`).
  - Wire-up
    - File: `api/main.py`: `from api.routers import metrics as metrics_router`; `app.include_router(metrics_router.router, prefix="/metrics", tags=["metrics"])`.

- [x] 5. Unit tests (aggregator)
  - File: `api/tests/test_metrics_aggregator.py` (NEW)
  - Arrange: minimal `ApiPlan` (2 lands, 2 workers, 2 events), synthetic `OptimizationResult.timeline`:
    - `land_spans`: spans covering 0–14 with `area_a` values
    - `events`: two days referencing both lands, one with workers assigned and one without
  - Act: monkeypatch `job_runner.snapshot` to return the fixture snapshot; call aggregate for day/decade.
  - Assert: `labor_total_per_a * area` math and land sums match expectations; decade produces two buckets `000:U` and `000:M`.

- [x] 6. Integration tests (router)
  - File: `api/tests/test_metrics_api.py` (NEW)
  - Use `TestClient` + monkeypatch snapshot
  - Cases: 200 for day/decade; 400 invalid bucket; 422 bad ranges; 404 unknown job.

- [x] 7. UI types and mapper
  - File: `ui/lib/types/planning.ts` (UPDATE)
    - Export TS types: `EventMetric`, `WorkerMetric`, `LandMetric`, `DaySummary`, `DayRecord`, `TimelineResponse`.
  - File: `ui/lib/types/result-mapper.ts` (NEW)
    - `export function mapTimelineResponse(json: unknown): TimelineResponse` // minimal validation + cast.

- [x] 8. Shared renderer and adapters
  - File: `ui/app/(planning)/components/metrics/CapacityTimeline.tsx` (NEW)
    - Props: `{ interval: 'day'|'decade'; records: DayRecord[]; mode: 'workers'|'lands' }`
    - Renders timeline: X = `day_index` or `period_key`; for each key show used vs capacity bars; legend + summary row (sum/avg/max).
  - File: `ui/app/(planning)/components/metrics/WorkersTimeline.tsx` (NEW)
    - Thin adapter: converts `records[].workers` to the shape expected by `CapacityTimeline`.
  - File: `ui/app/(planning)/components/metrics/LandsTimeline.tsx` (NEW)
    - Thin adapter: converts `records[].lands` similarly.

- [x] 9. Wire into existing MetricsCharts
  - File: `ui/app/(planning)/components/metrics/MetricsCharts.tsx` (UPDATE)
    - Add tabs: `Events / Workers / Lands`; add toggle: `Day / Decade`
    - Fetch: call `/metrics/timeline` with `job_id` and `start_day/end_day`; use `mapTimelineResponse`.

- [x] 10. UI tests
  - File: `ui/tests/components/metrics/CapacityTimeline.test.tsx` (NEW)
  - File: `ui/tests/components/metrics/WorkersTimeline.test.tsx` (NEW)
  - Cases: renders bars, legend present, summary totals computed; toggling `Day/Decade` changes number of bars.

Out of scope / notes
- No schema version fields; no over/highlight; no export.
- Calendar date buckets are out of scope in this iteration. If/when a base date is added to plan, extend router to accept `start/end` date strings and compute real U/M/L per month.
