"""
Optimization API data models (Pydantic v2).

- OptimizationRequest: 入力DTO（冪等性キー、パラメータ、タイムアウト/優先度）
- OptimizationResult: 出力DTO（ステータス、目的値、解、統計、警告）
- JobInfo: 非同期ジョブ情報（状態、進捗、結果、タイムスタンプ）

全モデルは extra="forbid" とし、未定義フィールドの受け入れを禁止する。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

StatusResult = Literal["ok", "infeasible", "timeout", "error"]
StatusJob = Literal[
    "pending",
    "running",
    "succeeded",
    "failed",
    "timeout",
    "canceled",
]


class OptimizationRequest(BaseModel):
    """最適化要求。

    - idempotency_key: 同一要求の重複投入防止用キー
    - plan: API向けの厳格スキーマ（推奨）
    - params: ドメイン固有の入力パラメータ（自由形式の辞書、非推奨）
    - timeout_ms: 同期実行のタイムアウト（ミリ秒）
    - priority: 実行優先度（小さいほど高優先度など、実装側の取り決め）
    """

    model_config = ConfigDict(extra="forbid", frozen=False)

    idempotency_key: str | None = Field(
        default=None,
        description="冪等性キー。重複投入防止のために利用可能。",
        examples=["abc123-20250101T000000Z"],
        min_length=1,
    )
    # 推奨: 厳格スキーマ
    plan: ApiPlan | None = Field(
        default=None,
        description="厳格スキーマ。Pydanticで入力値検証と整合性チェックを行う。",
    )
    # 互換: 自由形式（将来廃止予定）
    params: dict[str, Any] | None = Field(
        default=None,
        description="自由形式入力（非推奨）。plan が指定されていない場合のみ使用。",
        examples=[{"resources": {"labor": 10}, "objective": {"type": "idle_min"}}],
    )
    timeout_ms: int | None = Field(
        default=None,
        ge=1,
        description="同期呼び出しの最大許容時間（ミリ秒）。未指定でサービス既定値を使用。",
        examples=[2_000, 30_000],
    )
    priority: int | None = Field(
        default=None,
        description="ジョブ優先度。小さいほど高優先度など、実装依存。",
        examples=[0, 5, 10],
    )

    @model_validator(mode="after")
    def _either_plan_or_params(self):
        if self.plan is None and (self.params is None or self.params == {}):
            raise ValueError("plan もしくは params のいずれかを指定してください")
        return self


class OptimizationResult(BaseModel):
    """最適化結果。"""

    model_config = ConfigDict(extra="forbid")

    status: StatusResult = Field(
        description="結果ステータス（ok/infeasible/timeout/error）",
        examples=["ok"],
    )
    objective_value: float | None = Field(
        default=None, description="目的関数値。不可解/タイムアウト時は None。"
    )
    solution: dict[str, Any] | None = Field(
        default=None, description="解（割り当て結果など）。"
    )
    stats: dict[str, Any] = Field(
        default_factory=dict, description="統計情報（計算時間ms、探索ノード数など）。"
    )
    warnings: list[str] = Field(
        default_factory=list, description="警告メッセージ（制約緩和など）。"
    )
    timeline: OptimizationTimeline | None = Field(
        default=None,
        description="ガントチャート向けの時系列データ（任意）。",
    )


class JobInfo(BaseModel):
    """非同期ジョブ情報。"""

    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(description="ジョブ識別子。")
    status: StatusJob = Field(description="ジョブ状態。")
    # 0.0〜1.0 の進捗率
    progress: float = Field(default=0.0, ge=0.0, le=1.0, description="進捗率（0..1）")
    result: OptimizationResult | None = Field(
        default=None, description="完了時の最適化結果。未完了時は None。"
    )
    submitted_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="投入日時（UTC）。",
    )
    completed_at: datetime | None = Field(
        default=None, description="完了日時（UTC）。未完了時は None。"
    )


# ========================= Strict API models ========================= #


class ApiCrop(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    category: str | None = None
    # 価格は円/a または 円/10a のどちらか一方で指定
    price_per_a: float | None = Field(
        default=None, ge=0, description="作物価格（円/a）"
    )
    price_per_10a: float | None = Field(
        default=None, ge=0, description="作物価格（円/10a）"
    )

    @model_validator(mode="after")
    def _check_price_unit(self):
        if (self.price_per_a is None) == (self.price_per_10a is None):
            raise ValueError(
                "price_per_a と price_per_10a はどちらか一方のみ指定してください"
            )
        return self

    def normalized_price_per_a(self) -> float:
        return (
            float(self.price_per_a)
            if self.price_per_a is not None
            else float(self.price_per_10a) / 10.0
        )


class ApiEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    crop_id: str
    name: str
    category: str | None = None
    start_cond: set[int] | None = None
    end_cond: set[int] | None = None
    frequency_days: int | None = Field(default=None, gt=0)
    preceding_event_id: str | None = None
    lag_min_days: int | None = None
    lag_max_days: int | None = None
    people_required: int | None = Field(default=None, ge=0)
    labor_total_per_a: float | None = Field(default=None, ge=0, description="(h/a)")
    labor_daily_cap: float | None = Field(default=None, ge=0, description="(h/日)")
    required_roles: set[str] | None = None
    required_resources: set[str] | None = None
    uses_land: bool = False
    occupancy_effect: str | None = Field(
        default=None, description="start|hold|end|none"
    )

    @model_validator(mode="after")
    def _check_lag_and_occupancy(self):
        if self.lag_min_days is not None and self.lag_max_days is not None:
            if self.lag_min_days > self.lag_max_days:
                raise ValueError(
                    "lag_min_days は lag_max_days 以下である必要があります"
                )
        if self.uses_land:
            if self.occupancy_effect not in {"start", "hold", "end"}:
                raise ValueError(
                    "uses_land=True の場合、occupancy_effect は start|hold|end のいずれか"
                )
        else:
            if self.occupancy_effect not in {None, "none"}:
                raise ValueError(
                    "uses_land=False の場合、occupancy_effect は None または 'none'"
                )
        return self


class ApiLand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    area_a: float | None = Field(default=None, gt=0, description="面積[a]")
    area_10a: float | None = Field(default=None, gt=0, description="面積[10a]")
    tags: set[str] | None = None
    blocked_days: set[int] | None = None

    @model_validator(mode="after")
    def _check_area_units(self):
        if (self.area_a is None) == (self.area_10a is None):
            raise ValueError("area_a と area_10a はどちらか一方のみ指定してください")
        return self

    def normalized_area_a(self) -> float:
        return (
            float(self.area_a)
            if self.area_a is not None
            else float(self.area_10a) * 10.0
        )


class ApiWorker(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    roles: set[str] = Field(default_factory=set)
    capacity_per_day: float = Field(gt=0)
    blocked_days: set[int] | None = None


class ApiResource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    category: str | None = None
    capacity_per_day: float | None = Field(default=None, gt=0)
    blocked_days: set[int] | None = None


class ApiCropAreaBound(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crop_id: str
    min_area_a: float | None = Field(default=None, ge=0)
    min_area_10a: float | None = Field(default=None, ge=0)
    max_area_a: float | None = Field(default=None, ge=0)
    max_area_10a: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_bounds(self):
        def norm(v_a: float | None, v_10a: float | None) -> float | None:
            if v_a is not None:
                return v_a
            if v_10a is not None:
                return v_10a * 10.0
            return None

        min_v = norm(self.min_area_a, self.min_area_10a)
        max_v = norm(self.max_area_a, self.max_area_10a)
        if min_v is not None and max_v is not None and min_v > max_v:
            raise ValueError("min_area は max_area 以下である必要があります")
        return self


class ApiFixedArea(BaseModel):
    model_config = ConfigDict(extra="forbid")

    land_id: str
    crop_id: str
    area_a: float | None = Field(default=None, gt=0)
    area_10a: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def _check_area(self):
        if (self.area_a is None) == (self.area_10a is None):
            raise ValueError("area_a と area_10a はどちらか一方のみ指定してください")
        return self

    def normalized_area_a(self) -> float:
        return (
            float(self.area_a)
            if self.area_a is not None
            else float(self.area_10a) * 10.0
        )


class ApiPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    w_profit: float = Field(default=1.0, ge=0)
    w_labor: float = Field(default=1.0, ge=0)
    w_idle: float = Field(default=1.0, ge=0)
    w_dispersion: float = Field(default=1.0, ge=0)
    w_peak: float = Field(default=1.0, ge=0)
    w_diversity: float = Field(default=1.0, ge=0)


class ApiHorizon(BaseModel):
    model_config = ConfigDict(extra="forbid")

    num_days: int = Field(gt=0)


class OptimizationStagesConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage_order: list[str] = Field(
        default_factory=lambda: [
            "profit",
            "labor",
            "idle",
            "dispersion",
            "peak",
            "diversity",
        ]
    )
    tolerance_by_stage: dict[str, float] | None = Field(
        default=None, description="各ステージの許容率（0..1）"
    )
    step_tolerance_by: dict[str, float] | None = Field(
        default=None, description="段（サブステップ）ごとの許容率（0..1）"
    )

    @model_validator(mode="after")
    def _check_tolerances(self):
        def check_map(m: dict[str, float] | None, name: str):
            if m is None:
                return
            for k, v in m.items():
                if not (0.0 <= v <= 1.0):
                    raise ValueError("tolerance は 0..1 の範囲で指定してください")

        check_map(self.tolerance_by_stage, "tolerance_by_stage")
        check_map(self.step_tolerance_by, "step_tolerance_by")
        return self


class ApiPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    horizon: ApiHorizon
    crops: list[ApiCrop]
    events: list[ApiEvent]
    lands: list[ApiLand]
    workers: list[ApiWorker]
    resources: list[ApiResource]
    crop_area_bounds: list[ApiCropAreaBound] | None = None
    fixed_areas: list[ApiFixedArea] | None = None
    preferences: ApiPreferences | None = None
    stages: OptimizationStagesConfig | None = None

    @model_validator(mode="after")
    def _cross_checks(self):
        crop_ids = {c.id for c in self.crops}
        event_ids = {e.id for e in self.events}

        crop_to_events: dict[str, int] = dict.fromkeys(crop_ids, 0)
        for e in self.events:
            if e.crop_id not in crop_ids:
                raise ValueError(f"未知の crop_id を参照しています: {e.crop_id}")
            crop_to_events[e.crop_id] += 1

        no_event = [cid for cid, cnt in crop_to_events.items() if cnt == 0]
        if no_event:
            raise ValueError(f"作物に関連するイベントがありません: {no_event}")

        for e in self.events:
            if e.preceding_event_id is not None:
                if e.preceding_event_id not in event_ids:
                    raise ValueError(
                        f"preceding_event_id が存在しません: {e.preceding_event_id}"
                    )
                pred = next(ev for ev in self.events if ev.id == e.preceding_event_id)
                if pred.crop_id != e.crop_id:
                    raise ValueError("preceding_event は同一作物内で参照してください")

        max_day = self.horizon.num_days - 1

        def check_days(name: str, days: set[int] | None):
            if not days:
                return
            bad = [d for d in days if d < 0 or d > max_day]
            if bad:
                raise ValueError(f"blocked_days が範囲外です(0..{max_day}): {bad}")

        for l in self.lands:
            check_days(f"land:{l.id}", l.blocked_days)
        for w in self.workers:
            check_days(f"worker:{w.id}", w.blocked_days)
        for r in self.resources:
            check_days(f"resource:{r.id}", r.blocked_days)

        return self


__all__ = [
    "OptimizationRequest",
    "OptimizationResult",
    "JobInfo",
    "StatusResult",
    "StatusJob",
    # Strict API models
    "ApiPlan",
    "ApiHorizon",
    "ApiCrop",
    "ApiEvent",
    "ApiLand",
    "ApiWorker",
    "ApiResource",
    "ApiCropAreaBound",
    "ApiFixedArea",
    "OptimizationStagesConfig",
]


# ========================= Timeline (Gantt) models ========================= #


class GanttLandSpan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    land_id: str
    crop_id: str
    start_day: int = Field(ge=0)
    end_day: int = Field(ge=0)
    area_a: float = Field(ge=0)


class GanttEventItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day: int = Field(ge=0)
    event_id: str
    crop_id: str
    land_id: str | None = None
    worker_ids: list[str] = Field(default_factory=list)
    resource_ids: list[str] = Field(default_factory=list)


class OptimizationTimeline(BaseModel):
    model_config = ConfigDict(extra="forbid")

    land_spans: list[GanttLandSpan] = Field(default_factory=list)
    events: list[GanttEventItem] = Field(default_factory=list)
    # 各エンティティのID→表示名マップ
    entity_names: dict[str, dict[str, str]] = Field(default_factory=dict)
