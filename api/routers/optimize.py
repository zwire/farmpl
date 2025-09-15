from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from core.auth import require_auth
from schemas import JobInfo, OptimizationRequest, OptimizationResult
from services import job_runner
from services.optimizer_adapter import solve_sync_with_timeout

router = APIRouter(
    prefix="/v1", tags=["optimize"], dependencies=[Depends(require_auth)]
)


@router.post("/optimize", response_model=OptimizationResult)
def optimize_sync(
    request: OptimizationRequest,
    idem_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    idem_key_alt: Annotated[str | None, Header(alias="X-Idempotency-Key")] = None,
) -> OptimizationResult:
    if request.idempotency_key is None:
        request.idempotency_key = idem_key or idem_key_alt
    # Read timeout from config (app.state may not be easy to access here)
    try:
        from core import config as _cfg

        timeout_ms = _cfg.sync_timeout_ms()
    except Exception:
        timeout_ms = None
    return solve_sync_with_timeout(request, timeout_ms)


def _not_implemented() -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"message": "Async job runner is not implemented yet (Task 6)"},
    )


@router.post(
    "/optimize/async", response_model=JobInfo, status_code=status.HTTP_202_ACCEPTED
)
def optimize_async(request: OptimizationRequest) -> JobInfo:
    return job_runner.enqueue(request)


@router.get("/jobs/{job_id}", response_model=JobInfo)
def get_job(job_id: str) -> JobInfo:
    try:
        return job_runner.get(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail={"message": "job not found"})


@router.delete("/jobs/{job_id}", status_code=status.HTTP_202_ACCEPTED)
def cancel_job(job_id: str) -> dict[str, bool]:
    ok = job_runner.cancel(job_id)
    if not ok:
        raise HTTPException(
            status_code=404, detail={"message": "job not found or not cancelable"}
        )
    return {"canceled": True}
