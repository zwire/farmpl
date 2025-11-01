from __future__ import annotations

from core.config import Settings
from schemas import JobInfo, OptimizationRequest

from .job_backend import InMemoryJobBackend, JobBackend, JobSnapshot
from .job_backend_dynamo import DynamoJobBackend

_BACKEND: JobBackend | None = None


def _require(name: str, value: str | None) -> str:
    if value:
        return value
    raise RuntimeError(f"{name} must be configured when using Dynamo job backend")


def create_backend(settings: Settings) -> JobBackend:
    backend = settings.job_backend
    if backend == "inmemory":
        return InMemoryJobBackend()
    if backend == "dynamo":
        table_name = _require("JOBS_TABLE_NAME", settings.jobs_table_name)
        bucket_name = _require("JOB_PAYLOAD_BUCKET", settings.job_payload_bucket)
        queue_url = _require("JOB_QUEUE_URL", settings.job_queue_url)
        return DynamoJobBackend(
            table_name=table_name,
            bucket_name=bucket_name,
            queue_url=queue_url,
            jobs_ttl_days=settings.jobs_ttl_days,
        )
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
