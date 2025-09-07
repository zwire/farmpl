from __future__ import annotations

from lib import PlanRequest, PlanResponse, plan
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


def main() -> None:
    # Minimal demo request for skeleton wiring
    # Sample data: 2 lands, 2 crops with prices
    crops = [
        Crop(id="C1", name="Tomato", category="vegetable", price_per_area=1000),
        Crop(id="C2", name="Lettuce", category="vegetable", price_per_area=700),
    ]
    lands = [
        Land(id="L1", name="Field-1", area=1.0),  # 1.0 a
        Land(id="L2", name="Field-2", area=0.5),  # 0.5 a
    ]
    # Add minimal events with frequency and lag
    events = [
        Event(
            id="E_seed",
            crop_id="C1",
            name="Seeding",
            start_cond={1, 2, 3},
            end_cond={1, 2, 3},
        ),
        Event(
            id="E_irrig",
            crop_id="C1",
            name="Irrigate",
            start_cond={1, 2, 3, 4, 5, 6, 7},
            end_cond={1, 2, 3, 4, 5, 6, 7},
            frequency_days=3,
        ),
        Event(
            id="E_harv",
            crop_id="C1",
            name="Harvest",
            start_cond={3, 4, 5, 6, 7},
            end_cond={3, 4, 5, 6, 7},
            preceding_event_id="E_seed",
            lag_min_days=4,
            lag_max_days=6,
        ),
    ]

    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=crops,
        events=events,
        lands=lands,
        workers=[Worker(id="W1", name="Alice", capacity_per_day=8.0)],
        resources=[Resource(id="R1", name="Harvester", capacity_per_day=8.0)],
        fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=0.3)],
        crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.3, max_area=0.5)],
    )
    result: PlanResponse = plan(req)
    print({"feasible": result.diagnostics.feasible})
    # Print per-day assignment for each land
    for land_id, by_day in (result.assignment.crop_area_by_land_day or {}).items():
        for t in sorted(by_day.keys()):
            print({"land": land_id, "day": t, "area": by_day[t]})


if __name__ == "__main__":
    main()
