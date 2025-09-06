FarmPL API
==========

セットアップ
------------

1) 依存関係の同期

```bash
uv sync
```

2) テスト

```bash
uv run pytest -q
```

3) サンプル実行

```bash
uv run python -m api.main
```

入力例（抜粋）
--------------

以下は固定面積・作物上下限・イベント依存（頻度/ラグ）を含む最小例です。

```python
from lib.schemas import (
    Crop, Event, FixedArea, CropAreaBound, Resource, Worker, Land, Horizon, PlanRequest
)

req = PlanRequest(
    horizon=Horizon(num_days=7),
    crops=[
        Crop(id="C1", name="Tomato", price_per_area=1000),
        Crop(id="C2", name="Lettuce", price_per_area=700),
    ],
    events=[
        Event(id="E_seed", crop_id="C1", name="Seeding", start_cond={1,2,3}, end_cond={1,2,3}),
        Event(
            id="E_irrig", crop_id="C1", name="Irrigate",
            start_cond={1,2,3,4,5,6,7}, end_cond={1,2,3,4,5,6,7}, frequency_days=3
        ),
        Event(
            id="E_harv", crop_id="C1", name="Harvest",
            start_cond={3,4,5,6,7}, end_cond={3,4,5,6,7},
            preceding_event_id="E_seed", lag_min_days=2, lag_max_days=4
        ),
    ],
    lands=[Land(id="L1", name="Field-1", area=1.0)],
    workers=[Worker(id="W1", name="Alice", capacity_per_day=8.0)],
    resources=[Resource(id="R1", name="Harvester", capacity_per_day=8.0)],
    fixed_areas=[FixedArea(land_id="L1", crop_id="C1", area=0.5)],
    crop_area_bounds=[CropAreaBound(crop_id="C1", min_area=0.3, max_area=0.9)],
)
```

詳細は `api/docs/model.md` と `api/docs/tasks.md` を参照してください。


