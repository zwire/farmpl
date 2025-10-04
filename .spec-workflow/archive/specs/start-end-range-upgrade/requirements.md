# Requirements Document

## Introduction

FarmPLのプランニングUIではイベントの開始条件(`startDates`)と終了条件(`endDates`)を単一日付で入力するしかなく、実際に許容される複数日のウィンドウを表現できない。本機能では、ユーザーが期間を入力するとその期間に含まれる個々の日付が配列に展開され、既存の`startDates` / `endDates`配列に保存されるようにする。これにより、既存のPlanForm変換・最適化処理と互換性を保ちながら柔軟な日付指定を実現する。

## Alignment with Product Vision

- **解釈性優先**: UIでレンジを提示しつつ、配列には全日付を格納することで、内部処理は従来どおり日次粒度で制約を扱える。
- **現実性**: 現場では許容期間が連続した複数日で決まるケースが一般的であり、配列展開によりこの要件を満たす。
- **疎結合モジュール**: UIと状態管理のみを拡張し、APIレイヤーは既存仕様を継続利用する。

## Requirements

### Requirement 1

**User Story:** As a farm planner, I want to select one or more availability ranges for event start dates, so that the system can consider every permissible day without me enumerating them manually.

#### Acceptance Criteria

1. WHEN a user edits "開始条件" in `EventDetailsPanel` THEN the UI SHALL allow adding/removing ranges (使用コンポーネント: `DateRangeInput`).
2. WHEN the user saves ranges THEN the system SHALL expand each range into all individual ISO 日付を生成し、`PlanUiEvent.startDates` に重複なく昇順で保存する。
3. IF existing events store multiple start dates THEN the UI SHALL group consecutive dates into ranges and render them in the range editor for readability.

### Requirement 2

**User Story:** As a farm planner, I want to define completion windows via ranges, so that every acceptable deadline date is accounted for automatically.

#### Acceptance Criteria

1. WHEN a user edits "終了条件" in `EventDetailsPanel` THEN the UI SHALL allow the same range-based interaction as start dates。
2. WHEN ranges are saved THEN `PlanUiEvent.endDates` SHALL contain all expanded dates (重複排除・昇順)。
3. IF existing events already hold multiple end dates THEN the UI SHALL group them into ranges when displayed.

## Non-Functional Requirements

### Code Architecture and Modularity
- `EventDetailsPanel` は表示責務のみとし、配列変換ロジックは専用ユーティリティ（もしくは `planning-store`）に切り出す。
- `planning-store` は`startDates`/`endDates`配列のサニタイズを担当し、重複排除・ソートを共通化する。
- 追加のデータ構造を導入せず、既存APIとのインターフェースを維持する。

### Performance
- レンジ展開は日数分の O(n) であり、計画地平線が数百日程度でも実用的な速度を保つ。

### Security
- 既存のISO8601バリデーションを再利用し、不正日付は警告として取り扱う。

### Reliability
- サニタイズ処理とPlanForm変換テストを更新し、連続日付の往復変換（配列→レンジ→配列）が安定するよう検証する。

### Usability
- UIはレンジ追加時にデフォルト値（計画範囲の開始/終了）を提示し、ユーザーが簡単に期間を調整できるようにする。
