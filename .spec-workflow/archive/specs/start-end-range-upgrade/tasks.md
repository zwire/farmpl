# Tasks Document

- [x] 1. Update event detail UI for range editing
  - File: `ui/app/(planning)/components/events/EventDetailsPanel.tsx`
  - Replace単一日付入力を`DateRangeInput`に差し替え、レンジ編集をレンジ→日付配列変換ユーティリティと連携させる
  - _Leverage: `DateRangeInput`, `collapseDatesToRanges`, `expandRangesToDateList`, `PlanUiEvent`
  - _Requirements: Requirement 1, Requirement 2 (UIレンジ編集)
  - _Prompt: Implement the task for spec start-end-range-upgrade, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer with expertise in form UX | Task: Update `EventDetailsPanel.tsx` so that start/end date sections use `DateRangeInput`, converting ranges to date arrays via provided utilities and handling display from existing `startDates`/`endDates` | Restrictions: Do not introduce new global state; preserve component structure and translations; ensure clearing ranges also clears arrays | _Leverage: `DateRangeInput`, `collapseDatesToRanges`, `expandRangesToDateList`, `PlanUiEvent` | _Requirements: Requirement 1, Requirement 2 | Success: UI renders range controls, updates store with expanded date arrays, and rehydrates ranges from arrays

- [x] 2. Implement range/date array utilities in planning store
  - File: `ui/lib/state/planning-store.ts`
  - 連続日付配列←→レンジ相互変換ユーティリティを実装し、サニタイズフローとdraft保存に統合
  - _Leverage: `sanitizeDateList`, `PlanningCalendarService.dayIndexToDate`, `parseIsoDate`
  - _Requirements: Requirement 1, Requirement 2 (Range expansion + sanitization)
  - _Prompt: Implement the task for spec start-end-range-upgrade, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer focusing on data normalization | Task: Add utilities in `planning-store.ts` to convert between date arrays and ranges, integrate them into sanitize/load/save paths for events | Restrictions: Reuse existing helpers; keep utility pure; ensure horizon boundaries respected | _Leverage: `sanitizeDateList`, `PlanningCalendarService.dayIndexToDate`, `parseIsoDate` | _Requirements: Requirement 1, Requirement 2 | Success: Conversions work bidirectionally; duplicate dates removed; ranges clipped to horizon

- [x] 3. Adjust planning calendar conversion and tests
  - Files: `ui/lib/domain/planning-calendar.ts`, `ui/tests/domain/planning-calendar.test.ts`, `ui/tests/unit/planning-store.test.ts`
  - レンジ変換ロジックを考慮したテストケースを追加し、`convertToApiPlan`が展開済み配列を正しく処理することを確認
  - _Leverage: existing conversion helpers, warning generation utilities
  - _Requirements: Requirement 1, Requirement 2 (Data integrity)
  - _Prompt: Implement the task for spec start-end-range-upgrade, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer with expertise in domain conversions | Task: Ensure planning calendar conversion handles expanded arrays, update/extend unit tests to cover new utilities and range-to-array behavior | Restrictions: Maintain existing warning semantics; avoid regression in legacy path | _Leverage: conversion helpers, warning utilities | _Requirements: Requirement 1, Requirement 2 | Success: Tests cover both range expansion and legacy behavior, conversions remain stable

- [x] 4. Update documentation if needed
  - File: `ui/README.md` (or relevant docs)
  - レンジ入力→日付配列展開の振る舞いを開発者向けに追記（必要に応じて）
  - _Leverage: existing documentation style
  - _Requirements: Requirement 1, Requirement 2 (developer guidance)
  - _Prompt: Implement the task for spec start-end-range-upgrade, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Technical Writer with knowledge of FarmPL UI | Task: Document the new range-input behavior and conversion to date arrays | Restrictions: Keep documentation concise; reference relevant components | _Leverage: existing documentation style | _Requirements: Requirement 1, Requirement 2 | Success: Developers understand how ranges map to arrays and how to extend behavior
