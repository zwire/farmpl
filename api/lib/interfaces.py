from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from .model_builder import BuildContext
    from .solver import SolveContext


@runtime_checkable
class Toggleable(Protocol):
    """Interface for components that can be turned ON/OFF easily.

    tech.md: "各制約は簡単に ON/OFF でき…疎結合な共通インターフェース"
    """

    enabled: bool


class Constraint(ABC):
    """A constraint contributes feasibility conditions to the model.

    Implementations add variables/relations via a provided builder context.
    They should not assume the presence of other constraints.
    """

    enabled: bool = True

    @abstractmethod
    def apply(self, ctx: BuildContext) -> None: ...


class Objective(ABC):
    """An objective contributes a term to the global objective function.

    Note: The current planner composes objectives via lexicographic (stage-wise)
    optimization. Implementations should register a single expression; any
    weighting/combination is orchestrated by the planner, not by objectives.
    """

    enabled: bool = True

    @abstractmethod
    def register(self, ctx: BuildContext) -> None: ...


class DiagnosticsProvider(ABC):
    """Explainability hooks for infeasibility/quality analysis."""

    @abstractmethod
    def summarize(self, ctx: SolveContext) -> dict: ...
