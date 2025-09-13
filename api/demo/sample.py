from __future__ import annotations

from lib import PlanRequest
from lib.schemas import (
    Crop,
    CropAreaBound,
    Event,
    FixedArea,
    Horizon,
    Land,
    Resource,
    Worker,
)


def build_sample_request() -> PlanRequest:
    """Constructs the sample PlanRequest used by demos and CLI."""
    crops = [
        Crop(id="C1", name="Tomato", category="vegetable", price_per_area=1000),
        Crop(id="C2", name="Lettuce", category="vegetable", price_per_area=700),
        Crop(id="C3", name="Herb", category="herb", price_per_area=400),
    ]
    lands = [
        Land(id="L1", name="Field-1", area=1.0, blocked_days={1}),
        Land(id="L2", name="Field-2", area=0.5, blocked_days={5}),
    ]
    events = [
        Event(
            id="E_seed",
            crop_id="C1",
            name="Seeding",
            labor_total_per_area=2.0,
            labor_daily_cap=3.0,
            people_required=1,
            required_roles={"admin"},
            start_cond={1, 2, 3},
            end_cond={1, 2, 3},
            occupancy_effect="start",
        ),
        Event(
            id="E_irrig",
            crop_id="C1",
            name="Irrigate",
            labor_total_per_area=0.5,
            labor_daily_cap=1.0,
            people_required=1,
            required_roles={"admin"},
            start_cond={2, 3, 4, 5, 6},
            end_cond={2, 3, 4, 5, 6},
            preceding_event_id="E_seed",
            frequency_days=3,
        ),
        Event(
            id="E_harv",
            crop_id="C1",
            name="Harvest",
            labor_total_per_area=3.0,
            labor_daily_cap=3.0,
            people_required=1,
            required_roles={"admin", "harvester"},
            required_resources={"R1"},
            start_cond={3, 4, 5, 6, 7},
            end_cond={3, 4, 5, 6, 7},
            preceding_event_id="E_seed",
            lag_min_days=4,
            lag_max_days=6,
            occupancy_effect="end",
        ),
    ]

    return PlanRequest(
        horizon=Horizon(num_days=7),
        crops=crops,
        events=events,
        lands=lands,
        workers=[
            Worker(
                id="W1",
                name="Alice",
                capacity_per_day=8.0,
                roles={"admin"},
                blocked_days={3},
            ),
            Worker(id="W2", name="Bob", capacity_per_day=8.0, roles={"harvester"}),
        ],
        resources=[
            Resource(id="R1", name="Harvester", capacity_per_day=8.0, blocked_days={5})
        ],
        fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=0.3)],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.2, max_area=0.4)],
    )
