from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import config as app_config
from core import rate_limit as rate_limit_mw
from core.errors import install_exception_handlers
from core.logging import configure_root_logger, request_logging_middleware
from core.metrics import metrics


def _get_allowed_origins() -> list[str]:
    origins = os.getenv("CORS_ALLOW_ORIGINS", "*")
    return [o.strip() for o in origins.split(",") if o.strip()]


@asynccontextmanager
async def _lifespan(app: FastAPI):  # pragma: no cover
    yield
    try:
        from services import job_runner

        job_runner.shutdown(wait=False)
    except Exception:
        pass


def create_app() -> FastAPI:
    """Application factory.

    Wires basic middleware and a minimal health endpoint. Detailed routers, metrics,
    and auth will be added in subsequent tasks.
    """

    app = FastAPI(title="FarmPL Optimization API", version="0.1.0", lifespan=_lifespan)

    # CORS (liberal by default; tighten via env)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_get_allowed_origins(),
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
    if app_config.rate_limit_enabled():
        app.middleware("http")(rate_limit_mw.middleware)
    app.middleware("http")(metrics.middleware)

    # Read and validate config at startup (store in app.state)
    try:
        app.state.sync_timeout_ms = app_config.sync_timeout_ms()
        app.state.async_timeout_s = app_config.async_timeout_s()
        app.state.max_json_mb = app_config.max_json_mb()
        app.state.job_backend = app_config.job_backend()
        app.state.redis_url = app_config.redis_url()
    except Exception:
        pass

    # Centralized error handlers (422/Domain/HTTP/500)
    try:
        install_exception_handlers(app)
    except Exception:
        pass

    # Mount routers
    try:
        from routers.optimize import router as optimize_router

        app.include_router(optimize_router)
    except Exception:
        pass
    try:
        from routers.system import router as system_router

        app.include_router(system_router)
    except Exception:
        pass

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app
