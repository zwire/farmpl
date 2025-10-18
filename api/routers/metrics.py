from __future__ import annotations

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
    base_date: str = Query(
        ..., description="ISO date (YYYY-MM-DD) for 'third' bucketing base"
    ),
) -> TimelineResponse:
    try:
        return metrics_aggregator.aggregate(job_id, base_date_iso=base_date)
    except KeyError as err:
        raise HTTPException(
            status_code=404, detail={"message": "job not found"}
        ) from err
    except ValueError as e:
        # Bad ranges/invalid state
        msg = str(e)
        raise HTTPException(status_code=422, detail={"message": msg}) from None
