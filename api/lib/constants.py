"""
Project-wide constants.

- AREA_SCALE_UNITS_PER_A: integer scaling for area variables.
  1 unit = 0.1 a (are). Use this to integerize continuous areas.
"""

AREA_SCALE_UNITS_PER_A: int = 10

# Time scaling for worker/resource hours.
# 1 unit = 0.1 hour (6 minutes). Adjust if finer granularity is needed.
TIME_SCALE_UNITS_PER_HOUR: int = 10
