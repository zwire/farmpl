from __future__ import annotations

from core.config import Settings
from schemas import JobInfo, OptimizationRequest

from .job_backend import InMemoryJobBackend, JobBackend, JobSnapshot

_BACKEND: JobBackend | None = None


def create_backend(settings: Settings) -> JobBackend:
    if settings.job_backend == "inmemory":
        return InMemoryJobBackend()
    # Future backends (e.g., redis) can be added here
    return InMemoryJobBackend()


def configure(backend: JobBackend) -> None:
    global _BACKEND
    _BACKEND = backend


def _require_backend() -> JobBackend:
    if _BACKEND is None:
        raise RuntimeError("job backend not configured")
    return _BACKEND


def enqueue(req: OptimizationRequest) -> JobInfo:
    return _require_backend().enqueue(req)


def get(job_id: str) -> JobInfo:
    return _require_backend().get(job_id)


def cancel(job_id: str) -> bool:
    return _require_backend().cancel(job_id)


def shutdown(wait: bool = False) -> None:
    backend = _require_backend()
    backend.shutdown(wait=wait)


def snapshot(job_id: str) -> JobSnapshot:
    return _require_backend().snapshot(job_id)
