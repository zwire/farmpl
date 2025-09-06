from __future__ import annotations

from lib import PlanRequest, PlanResponse, plan
from lib.schemas import Crop, Horizon, Land


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
    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=crops,
        events=[],
        lands=lands,
        workers=[],
        resources=[],
    )
    result: PlanResponse = plan(req)
    print(
        {
            "feasible": result.diagnostics.feasible,
            "assignment": result.assignment.crop_area_by_land,
        }
    )


if __name__ == "__main__":
    main()
