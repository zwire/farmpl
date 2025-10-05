from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import require_auth
from schemas.metrics import TimelineResponse
from services import metrics_aggregator

router = APIRouter(
    prefix="/v1/metrics",
    tags=["metrics"],
    dependencies=[Depends(require_auth)],
)


@router.get("/timeline", response_model=TimelineResponse)
def get_metrics_timeline(
    job_id: str = Query(..., description="Job identifier returned by async optimize"),
    start_day: int = Query(..., ge=0, description="Start day index (0-based)"),
    end_day: int = Query(..., ge=0, description="End day index (0-based, inclusive)"),
    bucket: Literal["day", "decade"] = Query("day", description="Aggregation bucket"),
) -> TimelineResponse:
    # bucket is already validated by Literal typing; just call the service.
    try:
        return metrics_aggregator.aggregate(job_id, start_day, end_day, bucket)
    except KeyError:
        raise HTTPException(status_code=404, detail={"message": "job not found"})
    except ValueError as e:
        # Distinguish invalid bucket (shouldn't occur) vs bad ranges/invalid state
        msg = str(e)
        if "bucket must be" in msg:
            raise HTTPException(status_code=400, detail={"message": msg})
        raise HTTPException(status_code=422, detail={"message": msg})
