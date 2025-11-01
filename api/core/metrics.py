from __future__ import annotations

import time
from typing import Any

from fastapi import Request, Response


def _import_prom() -> tuple[Any | None, Any | None, Any | None, Any | None]:
    try:
        from prometheus_client import (
            CONTENT_TYPE_LATEST,
            Counter,
            Histogram,
            generate_latest,
        )

        return Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
    except Exception:
        return None, None, None, None


class Metrics:
    def __init__(self) -> None:
        Counter, Histogram, _, _ = _import_prom()
        if Counter is None or Histogram is None:
            self.enabled = False
            self.req_count = None
            self.req_latency = None
        else:
            self.enabled = True
            self.req_count = Counter(
                "http_requests_total",
                "Total HTTP requests",
                labelnames=("method", "path", "status"),
            )
            self.req_latency = Histogram(
                "http_request_duration_seconds",
                "HTTP request duration in seconds",
                labelnames=("method", "path"),
                buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
            )

    async def middleware(self, request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        start = time.perf_counter()
        try:
            response = await call_next(request)
            return response
        finally:
            if self.enabled and self.req_count and self.req_latency:
                try:
                    path = (
                        request.scope.get("route").path
                        if request.scope.get("route")
                        else request.url.path
                    )
                except Exception:
                    path = request.url.path
                method = request.method
                status = (
                    getattr(response, "status_code", 0) if "response" in locals() else 0
                )
                self.req_count.labels(
                    method=method, path=path, status=str(status)
                ).inc()
                self.req_latency.labels(method=method, path=path).observe(
                    time.perf_counter() - start
                )


metrics = Metrics()


def metrics_endpoint() -> Response:
    _, _, generate_latest, CONTENT_TYPE_LATEST = _import_prom()
    if generate_latest is None:
        return Response(
            content="# metrics disabled\n", media_type="text/plain; version=0.0.4"
        )
    data = generate_latest()  # type: ignore[misc]
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)  # type: ignore[arg-type]
