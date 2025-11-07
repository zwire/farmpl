from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .optimization import ApiPlan, OptimizationResult


class ApplicantProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, description="申請者氏名/屋号")
    address: str | None = Field(default=None, description="所在地")
    notes: str | None = Field(default=None, description="補足メモ")


class FinancialAssumptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currency: Literal["JPY"] = Field(default="JPY")
    wage_rate_per_hour: float = Field(
        default=1200.0, ge=0, description="労務の時給想定（円/時間）"
    )


class ExportSource(BaseModel):
    """どのデータから出力を行うか。

    - `job_id` を指定した場合はバックエンドから最新結果を取得する。
    - 直接 `result` を与える場合はそれを用いる。
    - `plan` は表示名や単価などの補助情報として利用（任意）。
    """

    model_config = ConfigDict(extra="forbid")

    job_id: str | None = Field(default=None, description="結果を参照するジョブID")
    result: OptimizationResult | None = None
    plan: ApiPlan | None = None

    @model_validator(mode="after")
    def _validate_source(self):
        if not self.job_id and not self.result:
            raise ValueError("job_id もしくは result のいずれかを指定してください")
        return self


class ExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    format: Literal["json", "zip_csv"] = Field(
        default="zip_csv", description="出力形式（JSON or CSVをZIPで同梱）"
    )
    # 配送方法: 直接レスポンスで返すか(SSE/CFの影響を受けやすい)、S3の署名付きURLにする
    delivery: Literal["stream", "url"] = Field(
        default="stream", description="zip_csv のときの返却方法"
    )
    source: ExportSource
    assumptions: FinancialAssumptions = Field(default_factory=FinancialAssumptions)
    applicant: ApplicantProfile | None = None


class CropFinancialRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crop_id: str
    crop_name: str | None = None
    area_a: float = 0.0
    price_per_a: float = 0.0
    revenue_yen: float = 0.0
    labor_hours: float = 0.0
    labor_cost_yen: float = 0.0


class WorkerHoursRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worker_id: str
    hours: float


class WorkerPeriodRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period_index: int
    worker_id: str
    worker_name: str | None = None
    roles: list[str] = Field(default_factory=list)
    hours: float


class ExportSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rows: list[CropFinancialRow]
    total_revenue_yen: float
    total_labor_cost_yen: float
    peak_worker_hours: float | None = None
    worker_rows: list[WorkerHoursRow] = Field(default_factory=list)
    worker_period_rows: list[WorkerPeriodRow] = Field(default_factory=list)
