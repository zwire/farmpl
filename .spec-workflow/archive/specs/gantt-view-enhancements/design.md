# Design Document

## Overview

本設計は、既存のガントチャート（`土地 × 日付` マトリクス、日単位スケール、テキストイベント表示）を拡張し、以下を実現する。

- 行ディメンションの切替（`土地 × 日付` と `作物 × 日付`）
- 日付スケールの選択（`日` と `旬（上旬/中旬/下旬）`）およびデフォルトを`旬`に変更
- イベントのカテゴリ別バッジ表示と集約、クリック時詳細（モーダル/ポップオーバー）
- 表示設定の永続化（ローカル）

UIは既存の`GanttChart`を中心に、責務分離（表示制御/スケール計算/データ整形/イベント集約/描画）を進め、可読性と再利用性を高める。

## Steering Document Alignment

### Technical Standards (tech.md)
- 追加ライブラリは導入せず、現行のReact + TypeScript構成を継続。
- 型を`@/lib/types`配下に集約し、ドメイン/表示のインターフェースを明確化。
- アクセシビリティ（ARIA、キーボード操作）と色コントラスト（WCAG AA）を考慮。

### Project Structure (structure.md)
- 既存の`ui/app/(planning)/components/gantt/*`に準拠して新規UIを配置。
- `@/lib/state`に表示設定のストア（Zustand）を追加、`@/lib/types`に型を追加。
- ユーティリティは`ui/app/(planning)/components/gantt/`配下にモジュール分割。

## Code Reuse Analysis

### Existing Components to Leverage
- **`GanttChart.tsx`**: レイアウトの骨格（グリッド、ヘッダ、セル描画）を再利用しつつ、ヘッダ/セル部をサブコンポーネント化して切替に対応。
- **`useGanttData.ts`**: タイムライン→ビュー用データ整形を拡張（行ディメンション切替、イベント集約入力の提供）。
- **`timeline-scale.ts`**: 既存`day`スケールを拡張し、`third`（旬）スケールを追加。ユニット幅やティック計算を共通化。

### Integration Points
- **Planning Store**（`@/lib/state/planning-store`）: `lastResult.timeline` と `plan.horizon` を継続利用。
- **新規 View Preferences Store**: ビューモードやスケール選択の永続化を担当（Zustand `persist`ミドルウェア）。

## Architecture

責務単位でモジュールを分割し、`GanttChart`は「表示制御と合成」に専念する。

```mermaid
graph TD
  GC[GanttChart] --> VC[ViewControls]
  GC --> SC[useTimelineScale]
  GC --> VM[useGanttViewModel]
  VM --> D1[land matrix]
  VM --> D2[crop matrix]
  GC --> EV[EventBadges]
  EV --> CL[classifyEventCategory]
  SC --> TS[timeline-scale(day, third)]
  GC --> ST[view-preferences store]
```

### Modular Design Principles
- 単一責任: 行ディメンション変換、スケール計算、イベント集約/色決定、UI描画を別モジュール化。
- 再利用性: スケール/集約は他画面でも再利用可能な純関数/小フックとして設計。
- パフォーマンス: 計算は`useMemo`/`useCallback`でメモ化。カラーハッシュは安定ハッシュを採用。

## Components and Interfaces

### 1) `ViewControls`（新規）
- Purpose: ビューモード（`land`/`crop`）とスケール（`third`/`day`）の切替UI（セグメントボタン）。
- Interfaces:
  - `ViewControls({ mode, scale, onModeChange, onScaleChange })`
- Dependencies: `view-preferences store`（双方向バインド）。

### 2) `useTimelineScale`（新規フック）
- Purpose: `timeline-scale.ts`の拡張APIを包み、`day`/`third`に応じたラベルと列幅を提供。
- Interfaces:
  - `useTimelineScale({ type, startDateIso, totalDays }) -> { unitWidth, ticks, formatTooltip }`
- Dependencies: `timeline-scale.ts`。

### 3) `useGanttViewModel`（新規フック）
- Purpose: 既存`useGanttData`の出力を受け、行ディメンション（`land`/`crop`）に応じたマトリクスを生成。
- Interfaces:
  - 入力: `base: ReturnType<useGanttData>`、`mode: 'land' | 'crop'`
  - 出力: `{ rowOrder: string[], rowLabelById: Record<string,string>, cellsByRow: Record<string, DayCell[]> }`
- Dependencies: `useGanttData`。

### 4) `EventBadges`（新規コンポーネント）
- Purpose: セル内イベントをカテゴリ集約し、色付きバッジで表示。クリックで詳細をポップオーバー。
- Interfaces:
  - `EventBadges({ events }: { events: GanttEventMarker[] })`
- Dependencies: `classifyEventCategory`, `colorForCategory`。

### 5) 既存 `GanttChart`（改修）
- Purpose: `ViewControls`と`useTimelineScale`/`useGanttViewModel`を組み合わせて描画。
- Interfaces: `GanttChart({ className? })`は現状維持。
- Reuses: `useGanttData`、新規フック/コンポーネント。

## Data Models

### 追加型（`@/lib/types/planning.ts` に統合）
```
export type GanttViewMode = 'land' | 'crop';
export type TimelineScaleType = 'day' | 'third';

// lib/types/planning.ts に配置
export type EventCategory =
  | '播種'
  | '定植'
  | '施肥'
  | '防除'
  | '潅水'
  | '収穫'
  | '搬出'
  | '圃場準備'
  | '片付け'
  | 'その他';

export interface CategoryBadge {
  category: EventCategory | string; // 既存データの自由入力も許容
  color: string; // hex
  count: number;
  items: GanttEventMarker[];
}
```

### View Preferences Store（`@/lib/state/view-preferences.ts` 予定）
```
interface ViewPreferencesState {
  gantt: {
    mode: GanttViewMode;         // default: 'crop'
    scale: TimelineScaleType;    // default: 'third'
    detailExpanded: boolean;     // イベント詳細の展開記憶
  };
  setGantt: (p: Partial<ViewPreferencesState['gantt']>) => void;
}
```

## Timeline Scale Design

### `third`（旬）スケール
- 区分: 月を上旬(1–10) / 中旬(11–20) / 下旬(21–月末)に分割。
- 列ラベル: `3月 上旬 / 中旬 / 下旬`（`isMajor`は各月の上旬列）。
- `day`→`thirdIndex`の対応: `startDateIso`からのオフセット日を暦日へ変換し、月内日で3分割判定。
- 列幅: `unitWidth`は`day`より広め（可視性向上、例: 28〜36px相当）。
- ツールチップ: 該当`third`の厳密日付範囲（開始〜終了、曜日含む）。

### 実装方針（`timeline-scale.ts`）
- `export type TimelineScaleType = 'day' | 'third'` に拡張。
- `createTimelineScale(options)`で`type`に応じて`createDayScale`/`createThirdScale`を選択。
- `TimelineTick`は`day`ではオフセット日、`third`では`thirdIndex`（0,1,2,...）を採用。呼び出し側は`ticks.length`を列数とする。
- `formatTooltip`は`day`/`third`で切替。

## Row Dimension Transformation

### `useGanttViewModel` の行変換
- `mode = 'land'`: 既存と同様（`landOrder`, `landDayCells`）。
- `mode = 'crop'`: `spans`から`cropId`の出現順を抽出し、`rowOrder = cropIds`、`cellsByRow[cropId][day]`へ投影。
  - 作付け中判定: 該当日の`span`存在で`cropStart`/`cropEnd`を設定。
  - イベント投影: `events`の`cropId`一致で当該日に追加。

## Event Aggregation & Badges

### カテゴリ分類（`classifyEventCategory.ts`）
- ヒューリスティクスは使用せず、文字列の完全一致のみで分類。
- 既定カテゴリ（上記`EventCategory`）に一致すればそのカテゴリ、
  一致しなければ自由入力ラベルとしてそのまま扱う（色はラベルから生成）。

### 色決定（`colorForCategory.ts`）
- 文字列の安定ハッシュ（DJB2等）→パレットインデックス、前景色は相対輝度で自動決定（黒/白）。

### 集約出力
- `aggregateEventsByCategory(events) -> CategoryBadge[]` を提供。
- バッジUIは `count` を表示し、クリックで同カテゴリの詳細リストをポップオーバー表示。
- アクセシビリティ: `button` + `aria-expanded`、`aria-controls`、キーボード操作対応。

### イベント編集UIへのサジェスト連携
- `app/(planning)/components/events/EventDetailsPanel.tsx` の「カテゴリ」入力は、
  既定カテゴリ（播種/定植/施肥/防除/潅水/収穫/搬出/圃場準備/片付け/その他）をサジェスト候補として表示。
- ユーザーはサジェストから選択、または自由入力で新規ラベルを入力可能。
- サジェストは`EventCategory[]`から生成し、自由入力はそのまま保存（後段の集約ではラベル完全一致で扱う）。

## Error Handling

### Error Scenarios
1. タイムライン未取得 / 空
   - Handling: 空状態カード＋現在のモード/スケールは保持。
   - User Impact: クラッシュせず説明文を表示。

2. 期間外参照（`third`計算で範囲外インデックス）
   - Handling: ガードとフォールバック（計算をスキップして列非表示）。
   - User Impact: 表示の欠落最小化、クラッシュ回避。

3. カテゴリ分類不能
   - Handling: `その他`カテゴリにフォールバック。
   - User Impact: 色はグレー系、意味はツールチップで補足。

## Testing Strategy

### Unit Testing
- `timeline-scale(third)`：
  - 月跨ぎ/閏年を含む3ヶ月程度のケースで`third`計算（境界: 10/20/月末）。
  - `formatTooltip`が厳密日付範囲を出すこと。
- `classifyEventCategory`：代表キーワードで正しいカテゴリが返ること。
- `aggregateEventsByCategory`：複数イベントが正しく集約/件数化されること。

### Integration Testing
- `useGanttViewModel`：`land`/`crop`切替で行順とセル投影が正しいこと。
- `GanttChart`：デフォルト`third`でヘッダが「上旬/中旬/下旬」になること、トグルUIが反映されること。

### End-to-End Testing
- シナリオ: 「要件に沿った初期状態→スケール/モード切替→バッジクリックで詳細表示→設定保持でリロード後も継続」。

## Implementation Notes

### 予定ファイル/変更点
- 新規: `ui/app/(planning)/components/gantt/ViewControls.tsx`
- 新規: `ui/app/(planning)/components/gantt/useGanttViewModel.ts`
- 新規: `ui/app/(planning)/components/gantt/event-badges.tsx`
- 新規: `ui/app/(planning)/components/gantt/classifyEventCategory.ts`（完全一致ベース）
- 新規: `ui/app/(planning)/components/gantt/colorForCategory.ts`
- 変更: `ui/app/(planning)/components/gantt/GanttChart.tsx`（コントロール導入、描画分割、デフォルト`third`）
- 変更: `ui/app/(planning)/components/gantt/timeline-scale.ts`（`third`スケール追加）
- 変更: `ui/app/(planning)/components/gantt/useGanttData.ts`（出力の再利用性向上、小整備）
- 変更: `ui/app/(planning)/components/events/EventDetailsPanel.tsx`（カテゴリ入力をサジェスト対応に）
- 新規: `ui/lib/state/view-preferences.ts`（Zustand `persist`）
- 変更: `ui/lib/types/planning.ts`（EventCategory をここで定義）

### パフォーマンス配慮
- スケール/行変換/集約は入力（`timeline`, `plan`, `mode`, `scale`）が等しい限りメモ化。
- 大量イベント時は表示を集約して計算量をO(カテゴリ数)に削減。

### アクセシビリティ
- コントロールは`role="tablist"`相当のセグメントUI（ラジオグループでも可）。
- バッジはボタン要素、`aria-label`で件数とカテゴリを読み上げ。
