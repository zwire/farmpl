from __future__ import annotations

from app import create_app

# ASGI entrypoint for uvicorn: `uvicorn api.main:app --reload`
app = create_app()
