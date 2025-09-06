from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model


@dataclass
class Variables:
    """Container for OR-Tools variables (simplified, no time index).

    Keys are tuples like (land_id, crop_id).
    """

    x_area_by_l_c: dict[tuple[str, str], cp_model.IntVar]
    z_use_by_l_c: dict[tuple[str, str], cp_model.BoolVar]


def create_empty_variables() -> Variables:
    return Variables(x_area_by_l_c={}, z_use_by_l_c={})
