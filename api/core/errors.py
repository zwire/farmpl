from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError


class DomainError(Exception):
    """Domain-level error that should map to a client-visible HTTP status."""

    def __init__(
        self, message: str, *, status_code: int = 400, code: str = "domain_error"
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


def _problem(
    status: int, title: str, detail: str, *, extras: dict[str, Any] | None = None
) -> JSONResponse:
    body: dict[str, Any] = {"status": status, "title": title, "detail": detail}
    if extras:
        body.update(extras)
    return JSONResponse(status_code=status, content=body)


def install_exception_handlers(app: FastAPI) -> None:
    logger = logging.getLogger(__name__)

    def _sanitize(obj: Any) -> Any:
        # Recursively convert validation error structures into JSON-safe values
        if isinstance(obj, Exception):
            return str(obj)
        if isinstance(obj, dict):
            return {k: _sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_sanitize(v) for v in obj]
        if isinstance(obj, tuple):
            return tuple(_sanitize(v) for v in obj)
        return obj

    @app.exception_handler(RequestValidationError)
    async def _handle_request_validation(request: Request, exc: RequestValidationError):  # type: ignore[override]
        errors = _sanitize(exc.errors())
        logger.warning(
            "422 Request validation failed: method=%s path=%s errors=%s",
            request.method,
            request.url.path,
            errors,
        )
        return _problem(
            422,
            "Unprocessable Entity",
            "Request validation failed",
            extras={"errors": errors},
        )

    @app.exception_handler(ValidationError)
    async def _handle_pydantic_validation(request: Request, exc: ValidationError):  # type: ignore[override]
        errors = _sanitize(exc.errors())
        logger.warning(
            "422 Payload validation failed: method=%s path=%s errors=%s",
            request.method,
            request.url.path,
            errors,
        )
        return _problem(
            422,
            "Unprocessable Entity",
            "Payload validation failed",
            extras={"errors": errors},
        )

    @app.exception_handler(DomainError)
    async def _handle_domain(_: Request, exc: DomainError):  # type: ignore[override]
        return _problem(
            exc.status_code, "Domain Error", exc.message, extras={"code": exc.code}
        )

    @app.exception_handler(HTTPException)
    async def _handle_http(_: Request, exc: HTTPException):  # type: ignore[override]
        detail = (
            exc.detail if isinstance(exc.detail, str) else getattr(exc, "detail", "")
        )
        extras = None
        if isinstance(exc.detail, dict):
            extras = {k: v for k, v in exc.detail.items() if k != "message"}
            detail = exc.detail.get("message", "")
        title = "HTTP Error"
        return _problem(exc.status_code or 500, title, detail or title, extras=extras)

    @app.exception_handler(Exception)
    async def _handle_generic(_: Request, __: Exception):  # type: ignore[override]
        return _problem(500, "Internal Server Error", "An unexpected error occurred")
