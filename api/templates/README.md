# 作物テンプレート（ファイル編集で拡張可能）

このフォルダには、UI から選べる「作物 × 作型」のテンプレートをテキスト（TOML）で格納します。API 側で読み込み、指定した開始日・計画期間に応じてイベントのラグ日数を動的に調整して `ApiPlan`（厳格スキーマ）を生成します。

## 目的
- ユーザーがイチから作物・作業計画を作らなくても、テンプレから初期値を選べるようにする。
- テンプレは将来、手作業でファイル追加・編集するだけで拡張できる。

## 配置とファイル形式
- 作物マスター: `api/templates/catalog/crops.toml`
- イベントテンプレ: `api/templates/crops/<crop>/<variant>.toml`
- 形式: TOML（Python 3.13 の標準 `tomllib` で読み込み、追加の依存は不要）

## テンプレート TOML のスキーマ
```toml
[template]
id = "minitomato_rouchi"
label = "ミニトマト(露地)"
crop_ref = "mt"           # 作物マスターへの参照（crops.toml の id）
variant = "露地"           # UI 表示用
price_per_a = 120000.0      # 円/a（ApiCrop の単位）

## 季節係数は廃止（開始日の月による倍率調整は行いません）

[[events]]                 # 1件のイベント定義
id = "sow"
name = "播種"
category = "播種"          # UI の EventCategory と一致
uses_land = false
start_window_days = [1, 7] # 計画 Day=1 からの相対ウィンドウ（両端含む）
labor_total_per_a = 2.0

[[events]]
id = "transplant"
name = "定植"
category = "定植"
uses_land = true
preceding_event_id = "sow"
lag_days = [25, 35]        # ラグ（最小, 最大）。季節係数で倍率調整
labor_total_per_a = 6.0
```

イベントの種類:
- `start_window_days = [s, e]` を持つイベント … Day=1 を起点とする実施可能ウィンドウ
- `lag_days = [min, max]` と `preceding_event_id` を持つイベント … 直前イベントからのラグ範囲
- `frequency_days` … 近接抑止のための最小間隔（日）。（強制回数ではない）
- `uses_land = true` … 占有区間（最初と最後の `uses_land=true` のイベントで区間が張られる）

### 注意（スタイルガイド）
- 季節係数は廃止しました。播種ウィンドウやラグは定義値のまま適用されます。
- uses_land の運用ルール（標準）
  - 原則、定植前の育苗および「出荷」イベント以外は `uses_land = true`。
  - 育苗イベント（例: `name = "播種（育苗…）"`、`…育苗…` を含む名称）は `uses_land = false`。
  - 「出荷」は `uses_land = false`。
  - 直播きでない（テンプレ内に「定植」イベントが存在する）場合の「播種」は育苗扱いとし、`uses_land = false`。
  - 直播き（テンプレ内に「定植」イベントが存在しない）場合の「播種」は圃場を占有するため `uses_land = true`。
  - 上記以外（圃場準備/定植/潅水/施肥/除草/防除/間引き/整枝/摘心/収穫/片付け/その他）は `uses_land = true` を基本とします。

## 追加・編集方法
1. 既存 TOML をコピーして新ファイルを作成
2. `[template]` セクションの `id`, `label` を一意に変更
3. `[[events]]` を必要に応じて追加/調整
4. 保存すると API の `/v1/templates` で自動検出・一覧化されます

## API エンドポイント
- `GET  /v1/templates` … テンプレの一覧（id, label, crop, variant など）
- `POST /v1/templates/instantiate` … テンプレを開始日と期間で具体化して `ApiPlan` を返す

### instantiate のリクエスト例
```json
{
  "template_id": "minitomato_rouchi",
  "start_date": "2025-04-10",
  "horizon_days": 160
}
```

### 補足
- `ApiPlan` は lands/workers/resources を空配列で返します。必要に応じて UI 側で後から追加してください。
