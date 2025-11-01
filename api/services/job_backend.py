from __future__ import annotations

import threading
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Protocol, runtime_checkable

from pydantic import BaseModel

from schemas import JobInfo, OptimizationRequest, OptimizationResult

_OA = None  # lazy import placeholder


class JobCanceled(Exception):
    """Raised to cooperatively cancel a running optimization job."""

    pass


@runtime_checkable
class JobBackend(Protocol):
    def enqueue(self, req: OptimizationRequest) -> JobInfo: ...
    def get(self, job_id: str) -> JobInfo: ...
    def cancel(self, job_id: str) -> bool: ...
    def snapshot(self, job_id: str) -> JobSnapshot: ...
    def shutdown(self, wait: bool = False) -> None: ...


class JobSnapshot(BaseModel):
    job: JobInfo
    req: OptimizationRequest | None
    result: OptimizationResult | None


class InMemoryJobBackend:
    class _State:
        __slots__ = (
            "req",
            "status",
            "progress",
            "result",
            "submitted_at",
            "completed_at",
            "future",
            "cancel_flag",
        )

        def __init__(self, req: OptimizationRequest) -> None:
            self.req = req
            self.status = "pending"
            self.progress = 0.0
            self.result: OptimizationResult | None = None
            self.submitted_at = datetime.now(UTC)
            self.completed_at: datetime | None = None
            self.future: Future | None = None
            self.cancel_flag = False

    def __init__(self, max_workers: int = 2) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, InMemoryJobBackend._State] = {}
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers, thread_name_prefix="job-runner"
        )

    def _to_model(self, job_id: str, st: _State) -> JobInfo:
        return JobInfo(
            job_id=job_id,
            status=st.status,  # type: ignore[arg-type]
            progress=st.progress,
            result=st.result,
            submitted_at=st.submitted_at,
            completed_at=st.completed_at,
        )

    def enqueue(self, req: OptimizationRequest) -> JobInfo:
        job_id = str(uuid.uuid4())
        st = InMemoryJobBackend._State(req)
        with self._lock:
            self._jobs[job_id] = st

        def _run() -> None:
            global _OA  # lazy load to avoid heavy deps at import time
            if _OA is None:
                from . import optimizer_adapter as _oa  # type: ignore

                _OA = _oa
            with self._lock:
                if st.cancel_flag:
                    st.status = "canceled"
                    st.progress = 1.0
                    st.completed_at = datetime.now(UTC)
                    return
                st.status = "running"
            try:
                if st.cancel_flag:
                    with self._lock:
                        st.status = "canceled"
                        st.progress = 1.0
                        st.completed_at = datetime.now(UTC)
                    return

                # progress callback updates shared state and checks cancel flag
                def _progress_cb(pct: float, phase: str) -> None:
                    with self._lock:
                        if st.cancel_flag:
                            raise JobCanceled()
                        st.progress = max(0.0, min(1.0, float(pct)))

                # Resolve at call time so test monkeypatching works
                # Call adapter with progress callback
                res = _OA.solve_sync(st.req, progress_cb=_progress_cb)
                with self._lock:
                    st.result = res
                    st.status = "succeeded" if res.status == "ok" else res.status  # type: ignore[assignment]
                    st.progress = 1.0
                    st.completed_at = datetime.now(UTC)
            except JobCanceled:
                with self._lock:
                    st.status = "canceled"  # type: ignore[assignment]
                    st.progress = 1.0
                    st.completed_at = datetime.now(UTC)
            except Exception:
                with self._lock:
                    st.status = "failed"  # type: ignore[assignment]
                    st.progress = 1.0
                    st.completed_at = datetime.now(UTC)

        fut = self._executor.submit(_run)
        with self._lock:
            st.future = fut
        return self._to_model(job_id, st)

    def get(self, job_id: str) -> JobInfo:
        with self._lock:
            st = self._jobs.get(job_id)
            if st is None:
                raise KeyError(job_id)
            return self._to_model(job_id, st)

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            st = self._jobs.get(job_id)
            if st is None:
                return False
            if st.status in {"succeeded", "failed", "timeout", "canceled"}:
                return False
            st.cancel_flag = True
        return True

    def snapshot(self, job_id: str) -> JobSnapshot:
        with self._lock:
            st = self._jobs.get(job_id)
            if st is None:
                raise KeyError(job_id)
            return JobSnapshot(
                job=self._to_model(job_id, st), req=st.req, result=st.result
            )

    def shutdown(self, wait: bool = False) -> None:
        with self._lock:
            for st in self._jobs.values():
                if st.status in {"pending", "running"}:
                    st.cancel_flag = True
        self._executor.shutdown(wait=wait, cancel_futures=False)
