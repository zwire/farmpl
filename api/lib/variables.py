from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Variables:
    """Handles symbolic variable identifiers used by the model.

    This is just a skeleton; actual OR-Tools var objects will be managed
    by the builder in `model_builder.py`.
    """

    # Examples of variable registries (keys are indices like (land, crop, day))
    x_area_by_l_c_t: dict[tuple[str, str, int], str]
    active_event_by_e_t: dict[tuple[str, int], str]


def create_variables() -> Variables:
    # Provide empty registries in the skeleton stage
    return Variables(x_area_by_l_c_t={}, active_event_by_e_t={})
