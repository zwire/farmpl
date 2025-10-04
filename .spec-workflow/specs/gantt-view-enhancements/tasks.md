# Tasks Document

概要（日本語）
- 本タスク群は、ガントチャートの表示強化（行ディメンション切替、旬スケール、イベントのカテゴリ別バッジ化、表示設定の永続化）を安全に段階導入するための実装手順を、最小責務単位に分解したものです。
- 既存の `GanttChart`/`useGanttData` を尊重しつつ、UIコンポーネント/フック/ユーティリティへ責務分離し、アクセシビリティとパフォーマンス（メモ化・軽量DOM）を担保します。
- 分類は「完全一致」のみとし、カテゴリ候補は `EventDetailsPanel` のサジェストから選択できるようにします。色はラベルからの安定ハッシュで自動決定します。

- [x] 1. planning.ts に EventCategory を追加しエクスポート
  - Files: ui/lib/domain/planning-ui-types.ts
  - 目的: 既定カテゴリ（播種/定植/施肥/防除/潅水/収穫/出荷/圃場準備/片付け/その他）を型として提供し、UIのサジェストや分類に利用可能にする。
  - 手順:
    1) `export type EventCategory = ...` を追加（上記10種）。
    2) `export const EVENT_CATEGORY_OPTIONS: readonly EventCategory[] = [...]` を追加（サジェスト用）。
    3) 既存 `PlanUiEvent.category?: string` は変更しない（後方互換）。
  - _Leverage: ui/lib/domain/planning-ui-types.ts_
  - _Requirements: Requirement 3, Requirement 4_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Domain Modeler | Task: Define EventCategory union and EVENT_CATEGORY_OPTIONS in planning.ts without breaking existing runtime shape | Restrictions: Keep PlanUiEvent shape intact | _Leverage: planning.ts | _Requirements: R3, R4 | Success: Types export correctly; project compiles._

- [x] 2. timeline-scale に 'third'(旬) スケールを追加
  - Files: ui/app/(planning)/components/gantt/timeline-scale.ts
  - 目的: デフォルト表示を旬スケールに切替可能にし、ツールチップで厳密な日付範囲を表示。
  - 手順:
    1) `TimelineScaleType` を `'day' | 'third'` に拡張。
    2) `createThirdScale` を実装（列=旬、ラベル=「3月 上旬/中旬/下旬」、isMajor=月の上旬）。
    3) うるう年/月末（28/29/30/31日）を考慮し、範囲の日付を計算。
    4) `createTimelineScale` で `type` に応じて day/third を返す。
    5) `unitWidth` は day より広め（例: 28）を既定、総幅/ティック整合を確認。
  - _Leverage: 既存 day スケール実装_
  - _Requirements: Requirement 2_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend Visualization Engineer | Task: Add 'third' scale with correct boundaries/labels/tooltips | Restrictions: No external deps; public API互換 | _Leverage: timeline-scale.ts | _Requirements: R2 | Success: third ticks/tooltip が期待通り。_

- [x] 3. 表示設定ストア（Zustand persist）を作成
  - Files: ui/lib/state/view-preferences.ts (new)
  - 目的: `mode`(land/crop) と `scale`(third/day) の選択、`detailExpanded` を永続化。
  - 手順:
    1) `create()` + `persist` で `gantt: { mode: 'crop', scale: 'third', detailExpanded: false }` を初期化。
    2) `setGantt(partial)` セッターを提供。
    3) 型エクスポートと軽いユニット関数（デフォルト適用）。
  - _Leverage: ui/lib/state/planning-store.ts（記法参照）_
  - _Requirements: Requirement 1, Requirement 2, Requirement 4_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React State Engineer | Task: Persisted view prefs store with sane defaults | Restrictions: planning-store に密結合しない | _Leverage: Zustand | _Requirements: R1, R2, R4 | Success: Reload後も設定が復元。_

- [x] 4. ViewControls コンポーネントを実装
  - Files: ui/app/(planning)/components/gantt/ViewControls.tsx (new)
  - 目的: モード（土地/作物）とスケール（旬/日）を切り替えるアクセシブルなUI。
  - 手順:
    1) セグメントボタン（ラジオグループ）を実装（role, aria-checked）。
    2) `view-preferences` と双方向バインド。
    3) 文言は日本語: 「表示モード」「スケール」。
  - _Leverage: 既存のTailwind/小パターン_
  - _Requirements: Requirement 1, Requirement 2, Requirement 4, Usability_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React UI Developer | Task: Accessible segmented controls bound to store | Restrictions: 外部UIライブラリ禁止 | _Leverage: local styles | _Requirements: R1, R2, R4, Usability | Success: キーボード操作/読み上げOK。_

- [x] 5. useGanttViewModel フック（行ディメンション変換）
  - Files: ui/app/(planning)/components/gantt/useGanttViewModel.ts (new)
  - 目的: `useGanttData` の出力を `land`/`crop` 行に投影し、描画に適した構造を返す。
  - 手順:
    1) `mode` に応じて `rowOrder` と `cellsByRow` を生成。
    2) メモ化（入力が同一なら同一参照）と安定キー。
    3) 空データのフォールバック（空配列）。
  - _Leverage: useGanttData.ts_
  - _Requirements: Requirement 1_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Data Modeling Engineer | Task: Implement efficient row switch | Restrictions: useGanttData APIは変更不可 | _Leverage: useGanttData | _Requirements: R1 | Success: 切替が速く、描画整合性が保たれる。_

- [x] 6. 分類（完全一致）と色ユーティリティ
  - Files: ui/app/(planning)/components/gantt/classifyEventCategory.ts (new), ui/app/(planning)/components/gantt/colorForCategory.ts (new)
  - 目的: イベントのカテゴリ判定（完全一致）と色決定（ハッシュ→パレット/前景色）。
  - 手順:
    1) `classifyEventCategory(label: string): string`（`EVENT_CATEGORY_OPTIONS` に一致→その文字列、非一致→そのまま返す）。
    2) `colorForCategory(name: string)`（djb2系ハッシュ→HSL/固定パレット、前景は相対輝度で黒/白）。
  - _Leverage: ui/lib/types/planning.ts (EventCategory)_
  - _Requirements: Requirement 3, Performance, Usability_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: UI Utility Engineer | Task: Exact-match classifier and WCAG-aware color | Restrictions: ライブラリ追加禁止 | _Leverage: planning.ts | _Requirements: R3 | Success: 色/分類が安定。_

- [x] 7. EventBadges コンポーネント実装
  - Files: ui/app/(planning)/components/gantt/event-badges.tsx (new)
  - 目的: セル内イベントをカテゴリ別に集約し、色バッジ＋件数で表示。クリックで詳細。
  - 手順:
    1) `aggregateEventsByCategory(events)` を内部で実装。
    2) バッジは `button` 要素、`aria-expanded` と `aria-controls` を付与。
    3) ポップオーバーはシンプルな相対配置（ポータル無し）。
  - _Leverage: classifyEventCategory, colorForCategory_
  - _Requirements: Requirement 3, Usability_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: UI Components Engineer | Task: Build accessible badges with aggregation | Restrictions: DOM過多禁止 | _Leverage: helpers | _Requirements: R3 | Success: 情報が見切れず、操作可能。_

- [x] 8. GanttChart を新構成にリファクタリング
  - Files: ui/app/(planning)/components/gantt/GanttChart.tsx
  - 目的: 新スケール/行モデル/バッジ/コントロールを統合し、デフォルトを旬に変更。
  - 手順:
    1) 先頭に `ViewControls` を表示。
    2) `view-preferences` から `mode`/`scale` を取得。
    3) `useTimelineScale(type)` を呼び出し、列（ticks）と幅を取得。
    4) `useGanttViewModel(mode)` の `rowOrder/cellsByRow` を描画。
    5) セル内イベントは `EventBadges` に置換。
    6) 空状態/説明文は現行を踏襲。
  - _Leverage: 既存構造, 新規コンポーネント_
  - _Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Integrator | Task: Wire everything coherently with default 'third' | Restrictions: 既存API互換 | _Leverage: hooks/components | _Requirements: R1, R2, R3, R4 | Success: 旬がデフォルト、切替/永続化が機能。_

- [x] 9. EventDetailsPanel をカテゴリサジェスト対応に
  - Files: ui/app/(planning)/components/events/EventDetailsPanel.tsx
  - 目的: 既定のカテゴリ候補を提示しつつ、自由入力も許容。
  - 手順:
    1) `EVENT_CATEGORY_OPTIONS` から `ComboBoxOption` 配列を作成。
    2) 既存のテキスト入力を `ComboBox` に置換（allowClear/自由入力）。
    3) `onChange` で `event.category` に文字列を保存。
  - _Leverage: ComboBox, planning.ts_
  - _Requirements: Requirement 3, Usability_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Forms Developer | Task: Suggest categories with free-text fallback | Restrictions: スキーマ変更禁止 | _Leverage: ComboBox | _Requirements: R3 | Success: 候補が出て選択/編集できる。_

- [x] 10. ユニットテスト: third スケール境界
  - Files: ui/tests/components/gantt/timeline-scale.third.test.ts (new)
  - 目的: 旬の区切り（10/20/月末）、月跨ぎ、うるう年の正当性検証。
  - 手順: UTC 固定で 2–3 ヶ月のケースを検証、tooltip の厳密日付範囲も確認。
  - _Leverage: timeline-scale.ts_
  - _Requirements: Requirement 2, Reliability_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend Test Engineer | Task: Deterministic tests for third scale | Restrictions: ロケール差抑止 | _Leverage: timeline-scale | _Requirements: R2 | Success: 全テスト緑。_

- [x] 11. ユニットテスト: 行ディメンション切替
  - Files: ui/tests/components/gantt/useGanttViewModel.test.ts (new)
  - 目的: land/crop 両モードで行順・セル投影が正しいことを検証。
  - 手順: `useGanttData` 出力をモックし、純関数として検証。
  - _Leverage: useGanttViewModel.ts_
  - _Requirements: Requirement 1, Reliability_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Testing Specialist | Task: Validate row switching output | Restrictions: DOM描画を伴わない | _Leverage: useGanttViewModel | _Requirements: R1 | Success: キー/ラベルの安定性を確認。_

- [x] 12. ユニットテスト: 分類と色・集約
  - Files: ui/tests/components/gantt/event-badges.test.tsx (new)
  - 目的: 完全一致分類、件数集約、前景色の可読性を検証。
  - 手順: 既定/自由入力の両方のケースを用意し、集約/色の安定性を確認。
  - _Leverage: classifyEventCategory.ts, colorForCategory.ts, event-badges.tsx_
  - _Requirements: Requirement 3, Usability_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: UI Testing Engineer | Task: Test grouping and contrast utility | Restrictions: スタイル断定を避ける | _Leverage: helpers/components | _Requirements: R3 | Success: 期待する集約/ラベル/fg色。_

- [x] 13. 統合テスト: 表示設定の永続化
  - Files: ui/tests/components/gantt/GanttChart.prefs.test.tsx (new)
  - 目的: デフォルトが旬/作物であること、トグルが persist で復元されることを検証。
  - 手順: persist ストレージをモックし、切替→再マウントで設定が復元されるかを確認。
  - _Leverage: GanttChart.tsx, view-preferences.ts_
  - _Requirements: Requirement 2, Requirement 4_
  - _Prompt: Implement the task for spec gantt-view-enhancements, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Testing Engineer | Task: Verify default/persist behavior | Restrictions: 実ストレージ未使用 | _Leverage: view-preferences | _Requirements: R2, R4 | Success: 既定/復元が正しく機能。_

