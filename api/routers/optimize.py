from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from core.auth import require_auth
from core.config import Settings
from schemas import JobInfo, OptimizationRequest, OptimizationResult
from services import job_runner
from services.optimizer_adapter import solve_sync_with_timeout

router = APIRouter(
    prefix="/v1",
    tags=["optimize"],
    dependencies=[Depends(require_auth)],
)


def _resolve_timeout(settings: Settings, request_timeout: int | None) -> int | None:
    if request_timeout is not None:
        return request_timeout
    return settings.sync_timeout_ms


@router.post("/optimize", response_model=OptimizationResult)
def optimize_sync(
    request_model: OptimizationRequest,
    request: Request,
    idem_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    idem_key_alt: Annotated[str | None, Header(alias="X-Idempotency-Key")] = None,
) -> OptimizationResult:
    if request_model.idempotency_key is None:
        request_model.idempotency_key = idem_key or idem_key_alt

    settings: Settings = request.app.state.settings
    timeout_ms = _resolve_timeout(settings, request_model.timeout_ms)
    return solve_sync_with_timeout(request_model, timeout_ms)


@router.post(
    "/optimize/async",
    response_model=JobInfo,
    status_code=status.HTTP_202_ACCEPTED,
)
def optimize_async(request_model: OptimizationRequest, request: Request) -> JobInfo:
    settings: Settings = request.app.state.settings
    timeout_ms = _resolve_timeout(settings, request_model.timeout_ms)
    request_model.timeout_ms = timeout_ms
    return job_runner.enqueue(request_model)


@router.get("/jobs/{job_id}", response_model=JobInfo)
def get_job(job_id: str) -> JobInfo:
    try:
        return job_runner.get(job_id)
    except KeyError as err:
        raise HTTPException(
            status_code=404, detail={"message": "job not found"}
        ) from err


@router.delete("/jobs/{job_id}", status_code=status.HTTP_202_ACCEPTED)
def cancel_job(job_id: str) -> dict[str, bool]:
    ok = job_runner.cancel(job_id)
    if not ok:
        raise HTTPException(
            status_code=404,
            detail={"message": "job not found or not cancelable"},
        )
    return {"canceled": True}
