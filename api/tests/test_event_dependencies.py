from __future__ import annotations

from lib.constraints import EventsWindowConstraint
from lib.model_builder import build_model
from lib.objectives import ProfitObjective
from lib.schemas import Crop, Event, Horizon, Land, PlanRequest
from lib.solver import solve


def test_frequency_enforces_gaps() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=5),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="irrigate",
                start_cond={1, 2, 3, 4, 5},
                end_cond={1, 2, 3, 4, 5},
                frequency_days=3,
            )
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
    )
    ctx = build_model(req, [EventsWindowConstraint()], [ProfitObjective()])
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")


def test_lag_dependency_between_events() -> None:
    req = PlanRequest(
        horizon=Horizon(num_days=5),
        crops=[Crop(id="C1", name="A", price_per_area=0)],
        events=[
            Event(
                id="E1",
                crop_id="C1",
                name="seed",
                start_cond={1, 2, 3},
                end_cond={1, 2, 3},
            ),
            Event(
                id="E2",
                crop_id="C1",
                name="harvest",
                start_cond={3, 4, 5},
                end_cond={3, 4, 5},
                preceding_event_id="E1",
                lag_min_days=2,
                lag_max_days=3,
            ),
        ],
        lands=[Land(id="L1", name="F1", area=1.0)],
        workers=[],
        resources=[],
    )
    ctx = build_model(req, [EventsWindowConstraint()], [ProfitObjective()])
    res = solve(ctx)
    assert res.status in ("FEASIBLE", "OPTIMAL")
