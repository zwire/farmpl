from __future__ import annotations

from mangum import Mangum

from app import create_app

_app = create_app()
handler = Mangum(_app, lifespan="auto")


__all__ = ["handler"]
