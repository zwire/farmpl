from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import config as app_config
from core import rate_limit as rate_limit_mw
from core.errors import install_exception_handlers
from core.logging import configure_root_logger, request_logging_middleware
from core.metrics import metrics
from routers.metrics import router as metrics_router
from routers.optimize import router as optimize_router
from routers.system import router as system_router
from routers.templates import router as templates_router
from services import job_runner


def _get_allowed_origins(settings: app_config.Settings) -> list[str]:
    origins = os.getenv("CORS_ALLOW_ORIGINS", "*")
    if origins == "*":
        return ["*"]
    return [o.strip() for o in origins.split(",") if o.strip()]


@asynccontextmanager
async def _lifespan(app: FastAPI):  # pragma: no cover
    async def shutdown_backend() -> None:
        backend = getattr(app.state, "job_backend", None)
        if backend is not None:
            try:
                backend.shutdown(wait=False)
            except Exception:
                pass

    try:
        yield
    finally:
        await shutdown_backend()


def create_app() -> FastAPI:
    """FarmPL API application factory."""

    settings = app_config.settings()

    app = FastAPI(title="FarmPL Optimization API", version="0.1.0", lifespan=_lifespan)
    app.state.settings = settings

    # CORS (liberal by default; tighten via env)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_get_allowed_origins(settings),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Configure structured logging
    try:
        configure_root_logger()
    except Exception:
        pass

    # Middleware order: logging -> rate-limit -> metrics
    app.middleware("http")(request_logging_middleware)

    rate_limiter = rate_limit_mw.RateLimiter.from_settings(settings)
    app.state.rate_limiter = rate_limiter
    if settings.rate_limit_enabled:
        app.middleware("http")(rate_limiter.middleware)

    app.middleware("http")(metrics.middleware)

    app.state.max_json_mb = settings.max_json_mb

    install_exception_handlers(app)

    job_backend = job_runner.create_backend(settings)
    job_runner.configure(job_backend)
    app.state.job_backend = job_backend

    app.include_router(optimize_router)
    app.include_router(templates_router)
    app.include_router(system_router)
    app.include_router(metrics_router)

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {"status": "ok"}

    return app
