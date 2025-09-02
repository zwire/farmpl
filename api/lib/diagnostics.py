from __future__ import annotations

from .interfaces import DiagnosticsProvider
from .solver import SolveContext


class BasicDiagnostics(DiagnosticsProvider):
    def summarize(self, ctx: SolveContext) -> dict:
        build = ctx.build
        req = build.request
        return {
            "status": ctx.status,
            "num_days": req.horizon.num_days,
            "num_crops": len(req.crops),
            "num_events": len(req.events),
            "num_lands": len(req.lands),
            "num_workers": len(req.workers),
            "num_resources": len(req.resources),
        }
