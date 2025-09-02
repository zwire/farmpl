from __future__ import annotations

from lib import PlanRequest, PlanResponse, plan
from lib.schemas import Horizon


def main() -> None:
    # Minimal demo request for skeleton wiring
    req = PlanRequest(
        horizon=Horizon(num_days=7),
        crops=[],
        events=[],
        lands=[],
        workers=[],
        resources=[],
    )
    result: PlanResponse = plan(req)
    print(
        {
            "feasible": result.diagnostics.feasible,
            "status": "NOT_SOLVED",
            "assignment_keys": list(result.assignment.crop_area_by_land.keys()),
        }
    )


if __name__ == "__main__":
    main()
