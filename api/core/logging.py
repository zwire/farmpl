from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from typing import Any

from fastapi import Request, Response

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    return request_id_ctx.get()


def _json_log(logger: logging.Logger, level: int, msg: str, **fields: Any) -> None:
    record = {"msg": msg, **fields}
    logger.log(level, json.dumps(record, ensure_ascii=False))


async def request_logging_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    token = request_id_ctx.set(rid)
    logger = logging.getLogger("api")
    start = time.perf_counter()
    _json_log(
        logger,
        logging.INFO,
        "request.start",
        method=request.method,
        path=request.url.path,
        request_id=rid,
    )
    try:
        response = await call_next(request)
    finally:
        duration = time.perf_counter() - start
        status = getattr(locals().get("response", None), "status_code", 0)
        _json_log(
            logger,
            logging.INFO,
            "request.end",
            method=request.method,
            path=request.url.path,
            status=status,
            duration_ms=int(duration * 1000),
            request_id=rid,
        )
        request_id_ctx.reset(token)
    response.headers.setdefault("X-Request-ID", rid)
    return response


def configure_root_logger(level: int = logging.INFO) -> None:
    logging.basicConfig(level=level, format="%(message)s")
