"""FarmPL library package skeleton.

This package provides the high-level planning API and modular components:
- Pydantic schemas for I/O
- Constraint and objective interfaces (loosely coupled, ON/OFF-able)
- Variables factory
- Model builder and solver executor (OR-Tools CP-SAT oriented)
- Diagnostics interfaces for explainability

Note: Avoid importing heavy submodules (e.g., OR-Tools bindings) at package
import time to keep lightweight utilities importable without optional deps.
We expose planner symbols lazily via module-level ``__getattr__``.
"""

__all__ = ["PlanRequest", "PlanResponse", "plan"]


def __getattr__(name: str):  # pragma: no cover - thin lazy loader
    if name in {"PlanRequest", "PlanResponse", "plan"}:
        from .planner import PlanRequest, PlanResponse, plan  # type: ignore

        return {"PlanRequest": PlanRequest, "PlanResponse": PlanResponse, "plan": plan}[
            name
        ]
    raise AttributeError(name)
