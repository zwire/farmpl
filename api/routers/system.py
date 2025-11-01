from __future__ import annotations

from fastapi import APIRouter

from core.metrics import metrics_endpoint

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/readyz")
def readyz() -> dict:
    issues: list[str] = []
    ok = True
    # Optional dependency checks (soft-fail)
    try:
        import ortools  # type: ignore  # noqa: F401
    except Exception:
        ok = False
        issues.append("ortools-not-importable")
    return {"ready": ok, "issues": issues}


@router.get("/metrics")
def metrics_get():  # type: ignore[no-untyped-def]
    return metrics_endpoint()
