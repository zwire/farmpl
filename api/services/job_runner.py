from __future__ import annotations

from schemas import JobInfo, OptimizationRequest

from .job_backend import InMemoryJobBackend, JobBackend

_backend: JobBackend = InMemoryJobBackend()


def enqueue(req: OptimizationRequest) -> JobInfo:
    return _backend.enqueue(req)


def get(job_id: str) -> JobInfo:
    return _backend.get(job_id)


def cancel(job_id: str) -> bool:
    return _backend.cancel(job_id)


def shutdown(wait: bool = False) -> None:
    _backend.shutdown(wait=wait)
