from __future__ import annotations

from dataclasses import dataclass

from .model_builder import BuildContext


@dataclass
class SolveContext:
    build: BuildContext
    # In full impl, this may include solver status, objective value, etc.
    status: str = "UNKNOWN"


def solve(ctx: BuildContext) -> SolveContext:
    # Skeleton: no actual optimization yet
    return SolveContext(build=ctx, status="NOT_SOLVED")
