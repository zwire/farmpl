"""FarmPL library package skeleton.

This package provides the high-level planning API and modular components:
- Pydantic schemas for I/O
- Constraint and objective interfaces (loosely coupled, ON/OFF-able)
- Variables factory
- Model builder and solver executor (OR-Tools CP-SAT oriented)
- Diagnostics interfaces for explainability
"""

from .planner import PlanRequest, PlanResponse, plan

__all__ = [
    "PlanRequest",
    "PlanResponse",
    "plan",
]
