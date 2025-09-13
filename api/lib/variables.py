from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model


@dataclass
class Variables:
    """Container for OR-Tools variables.

    Spatial area variables use keys (land_id, crop_id).
    Partially time-indexed variables use keys that include day t.
    """

    # Base area variables (constant across days)
    x_area_by_l_c: dict[tuple[str, str], cp_model.IntVar]
    # Time-indexed area variables
    x_area_by_l_c_t: dict[tuple[str, str, int], cp_model.IntVar]
    z_use_by_l_c: dict[tuple[str, str], cp_model.BoolVarT]

    # Partial time-indexed variables
    r_event_by_e_t: dict[tuple[str, int], cp_model.BoolVarT]
    h_time_by_w_e_t: dict[tuple[str, str, int], cp_model.IntVar]
    assign_by_w_e_t: dict[tuple[str, str, int], cp_model.BoolVarT]
    u_time_by_r_e_t: dict[tuple[str, str, int], cp_model.IntVar]
    over_by_t: dict[int, cp_model.IntVar]
    # Time-indexed idle per land
    idle_by_l_t: dict[tuple[str, int], cp_model.IntVar]
    # Occupancy by crop and day
    occ_by_c_t: dict[tuple[str, int], cp_model.BoolVarT]
    # Crop-level usage indicator (1 if any land uses the crop)
    use_by_c: dict[str, cp_model.BoolVarT]


def create_empty_variables() -> Variables:
    return Variables(
        x_area_by_l_c={},
        x_area_by_l_c_t={},
        z_use_by_l_c={},
        r_event_by_e_t={},
        h_time_by_w_e_t={},
        assign_by_w_e_t={},
        u_time_by_r_e_t={},
        over_by_t={},
        idle_by_l_t={},
        occ_by_c_t={},
        use_by_c={},
    )
