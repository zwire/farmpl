# Requirements Document

## Introduction

本仕様はメトリクスの強化に関する要件を定義する。現状はAPIが出力するメトリクス値をそのままUIに表示しているだけで、意思決定に有用な情報（ピーク/余裕）が得づらい。そこで、日別および旬別（上:1–10日, 中:11–20日, 下:21日–月末）の2軸で、
- 各作業者の各時点での作業時間の可視化（キャパ対比）
- 各土地の各時点での使用率の可視化（キャパ対比）
を提供し、ピーク・余裕期間の把握を容易にする。

## Alignment with Product Vision

- Product（FarmPL）の目的「現実的な作業負荷の両立」「ボトルネック可視化」を直接支援（.spec-workflow/steering/product.md）。
- Tech方針（FastAPI, Pydantic, 疎結合設計）に従い、API側でデータ整形を行い、UIは可視化に注力（.spec-workflow/steering/tech.md）。
- 構成（api/lib*, ui/*）の責務分離を維持（.spec-workflow/steering/structure.md）。

## Requirements

### R1: APIでの日/旬レコード集約データ提供（再最適化なし）

**User Story:** 計画閲覧者として、日・旬の単位で「作業者の稼働/キャパ対比」と「土地の使用率/キャパ対比」を取得したい。そうすることで、ピークやキャパ超過が一目で分かる。

#### Acceptance Criteria
1. WHEN クエリで `job_id` と対象期間/集計軸（`bucket=day|decade`）を指定 THEN APIは各時点の`DayRecord`を返す。最適化の再実行は不要とする（サーバは`job_backend`に保持する中間表現から集計）。
2. IF 集計軸=日 THEN `DayRecord.interval = "day"` かつ `date` はYYYY-MM-DD。
3. IF 集計軸=旬 THEN `DayRecord.interval = "decade"` かつ `period_key` は `YYYY-MM:U|M|L`（U=1–10, M=11–20, L=21–eom）。
4. WHEN レスポンス有無に関わらず THEN `events`, `workers`, `lands`, `summary` フィールドが存在し、不在データは空配列/0で返却。

```
DayRecord (interval: "day" | "decade")
- date?: string  // interval=day の場合
- period_key?: string // interval=decade の場合（例: 2025-03:U）
- events: EventMetric[]
- workers: WorkerMetric[]
- lands: LandMetric[]
- summary:
    - labor_total_hours: number  // 当該日/旬の総労働時間
    - labor_capacity_hours: number // 総キャパ（全作業者）
    - land_total_area: number     // 使用面積の合計
    - land_capacity_area: number  // 総キャパ（全土地）

EventMetric
- id: string
- label: string
- start: string // ISO date
- end: string   // ISO date (inclusive/exclusiveはUI側と一致)
- type: string  // sowing/harvest/etc.

WorkerMetric
- worker_id: string
- name: string
- utilization: number  // 当該日/旬の稼働時間（h）
- capacity: number     // キャパ（h）

LandMetric
- land_id: string
- name: string
- utilization: number  // 当該日/旬の使用面積
- capacity: number     // キャパ面積
```

### R2: イベントスキーマの互換変更を許容（バージョンフィールド不要）

**User Story:** 実装者として、可視化に適した形へイベントスキーマを変更したい。そうすることで、API側の整形が容易になり、UIは一貫フォーマットで描画できる。

#### Acceptance Criteria
1. WHEN 必要に応じて THEN 既存イベントスキーマの互換性は保持しなくてもよい。
2. バージョン管理用の`metrics_schema_version`等は付与しない（UIは受領フィールドに素直に追随）。

### R3: UIでの3系統タイムライン可視化（ハイライト/over不要）

**User Story:** 計画閲覧者として、イベント・作業者・土地の3つのタイムラインを同一期間で切替/併置表示したい。そうすることで、関連を直感的に把握できる。

#### Acceptance Criteria
1. WHEN 期間を選択 THEN タブ/トグルで `イベント / 作業者 / 土地` を切替可能。
2. WHEN 集計軸切替 THEN `日` と `旬` 表示を切替可能（デフォルト=日）。
3. WHEN 作業者タブ THEN 棒/エリア系のタイムラインで `utilization/capacity` を表示（超過ハイライトやoverフラグは不要）。
4. WHEN 土地タブ THEN 同様に `utilization/capacity` を表示（超過ハイライトやoverフラグは不要）。
5. WHEN 端部（パネル右/下） THEN 当該期間の集計（合計/平均/最大）をサマリーカード表示。

補足: UIは非同期最適化を用いて `job_id` を取得・保持し、集計は常にAPIから取得する（UI側で独自変換は行わない）。`job_id` はダッシュボードに配線してタイムラインを描画する。

（削除）キャパ超過の強調表示は本スコープ外。UIは値表示に専念する。

（削除）当面エクスポート機能は実装しない。

## Non-Functional Requirements

### Code Architecture and Modularity
- APIはPydanticスキーマで`DayRecord`系を厳密定義し、整形はサービス層に集約。
- UIは描画コンポーネントとデータフェッチ/整形を分離。

### Performance
- 30日×作業者50×土地100の範囲でP95<300ms（API処理）、UI初期描画<1.0sを目標。

### Security
- API化時は認証・レート制限を前提（現状はローカル）。

### Reliability
- スキーマバージョンを付与し、破壊的変更を可視化。

### Usability
- 色分け（通常/注意/超過）、凡例、ツールチップを標準化。視認性優先。
