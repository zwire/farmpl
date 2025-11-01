"""Lightweight services namespace.

Avoid importing heavy submodules (e.g., optimizer/OR-Tools) at package import
time to keep routers and tools importable without optional deps.
"""

from . import job_runner

__all__ = ["job_runner"]
