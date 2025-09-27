# Tasks Document

- [x] 1. Establish UI domain types and calendar conversion service
  - Files: ui/lib/domain/planning-ui-types.ts, ui/lib/domain/planning-calendar.ts, ui/tests/domain/planning-calendar.test.ts
  - PlanUiStateインターフェースとDateRangeモデルを定義し、日付↔日数変換・地平線の再計算・範囲クリッピングを担うヘルパー群を実装する。
  - オフセット変更やオープンエンド、無効入力などの境界ケースを網羅する単体テストを追加する。
  - _Leverage: ui/lib/types/planning.ts, ui/lib/validation/plan-schema.ts_
  - _Requirements: Requirement 1, Requirement 2, Requirement 3 (architecture alignment)
  - _Prompt: Implement the task for spec planning-ui-calendar-domain, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend Domain Engineer with expertise in date handling | Task: Introduce UI domain types and a PlanningCalendarService that maps PlanUiState to the existing PlanFormState while enforcing date-based rules, plus accompanying unit tests | Restrictions: Do not modify api/lib code, keep API-facing types backward compatible, ensure utilities are framework-agnostic | _Leverage: ui/lib/types/planning.ts, ui/lib/validation/plan-schema.ts | _Requirements: Requirement 1, Requirement 2, Requirement 3 | Success: Conversion outputs pass planFormSchema validation, tests cover start/end edge cases, utilities exported for reuse | Instructions: Before starting change this task checkbox to [-] in tasks.md, after completing and validating change it to [x]._

- [x] 2. Refactor planning store to use PlanUiState and integrate conversion service
  - Files: ui/lib/state/planning-store.ts, ui/lib/state/__tests__/planning-store.test.ts (new)
  - ストアの状態形をPlanUiStateへ更新し、ドラフト保存/読込が日付ベースの状態を扱えるようローカルストレージ処理を調整する。
  - PlanningCalendarServiceをマーク/リセット動作に組み込み、既存ドラフト（旧フォーマット）を自動移行できるようにする。
  - _Leverage: ui/lib/domain/planning-calendar.ts, ui/app/(planning)/components/request-wizard/steps.ts_
  - _Requirements: Requirement 1, Requirement 2, Non-Functional (State Consistency, Reliability)
  - _Prompt: Implement the task for spec planning-ui-calendar-domain, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React State Management Specialist | Task: Refactor the planning Zustand store to hold PlanUiState, hook in conversion helpers for resets/saves, and add regression tests | Restrictions: Preserve public store API, avoid breaking existing selectors, ensure legacy drafts migrate cleanly | _Leverage: ui/lib/domain/planning-calendar.ts, ui/app/(planning)/components/request-wizard/steps.ts | _Requirements: Requirement 1, Requirement 2, Non-Functional (State Consistency, Reliability) | Success: Store compiles with new types, tests cover migration & persistence, manual draft save/load works with dates | Instructions: Before starting change this task checkbox to [-] in tasks.md, after completing and validating change it to [x]._

- [x] 3. Implement horizon date picker UI and integrate with wizard
  - Files: ui/app/(planning)/components/request-wizard/HorizonSection.tsx (new), ui/app/(planning)/components/request-wizard/StepSections.tsx, ui/app/(planning)/components/request-wizard/index.ts
  - react-day-pickerを用いた日付レンジピッカーを導入し、計画期間の開始日・終了日と自動計算された日数を表示する。
  - 開始日が変わった際にストアの依存値が再計算されるようウィザードの状態連携を更新する。
  - _Leverage: ui/lib/domain/planning-calendar.ts, ui/lib/state/planning-store.ts_
  - _Requirements: Requirement 1, Usability, Performance
  - _Prompt: Implement the task for spec planning-ui-calendar-domain, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React UI Engineer focused on date inputs | Task: Add HorizonSection with calendar controls powered by react-day-picker and connect it to the planning store | Restrictions: Keep StepSections modular, add minimal dependency footprint, ensure accessibility attributes | _Leverage: ui/lib/domain/planning-calendar.ts, ui/lib/state/planning-store.ts | _Requirements: Requirement 1, Usability, Performance | Success: Users can pick start/end dates via calendar, duration auto-updates, builds pass with new dependency declarations | Instructions: Before starting change this task checkbox to [-] in tasks.md, after completing and validating change it to [x]._

- [x] 4. Replace comma-based availability inputs with range UI controls
  - Files: ui/app/(planning)/components/request-wizard/AvailabilitySection.tsx (new), ui/app/(planning)/components/request-wizard/StepSections.tsx, ui/app/(planning)/components/request-wizard/inputs/DateRangeInput.tsx (new)
  - 土地・作業者・リソースの封鎖期間をレンジ選択と単日追加で管理できるUIを構築し、カンマ区切り入力を置き換える。
  - オープンエンドの設定やタグ/ロール/リソース配列をチップUIで編集し、範囲超過時にはバリデーションメッセージを表示する。
  - _Leverage: ui/lib/domain/planning-calendar.ts, ui/lib/state/planning-store.ts_
  - _Requirements: Requirement 2, Non-Functional (Usability, Data Validation)
  - _Prompt: Implement the task for spec planning-ui-calendar-domain, first run spec-workflow-guide to get the workflow guide then implement the task: Role: UI/UX Engineer specializing in complex form inputs | Task: Replace blockedDays text inputs with intuitive date range controls and chip-based multi-select handling | Restrictions: Maintain responsive layout, reuse existing styling tokens, do not reintroduce free-form comma fields | _Leverage: ui/lib/domain/planning-calendar.ts, ui/lib/state/planning-store.ts | _Requirements: Requirement 2, Non-Functional (Usability, Data Validation) | Success: Users manage blocked ranges visually, open-ended option works, data persists correctly after reload | Instructions: Before starting change this task checkbox to [-] in tasks.md, after completing and validating change it to [x]._

- [x] 5. Build collapsible event details panel integrated with ReactFlow
  - Files: ui/app/(planning)/components/events/EventGraphEditor.tsx, ui/app/(planning)/components/events/EventDetailsPanel.tsx (new), ui/app/(planning)/components/request-wizard/StepSections.tsx
  - ReactFlowで選択したノード/エッジに応じて詳細パネルを表示し、折りたたみ可能なセクションで条件・ラグ・必要リソースを編集できるようにする。
  - エッジ操作に合わせてPlanningCalendarServiceを呼び出し、precedingEventIdや開始条件の最低日数を自動補正する。
  - _Leverage: ui/lib/domain/planning-calendar.ts, ui/lib/state/planning-store.ts_
  - _Requirements: Requirement 3, Non-Functional (Usability)
  - _Prompt: Implement the task for spec planning-ui-calendar-domain, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Visualization Engineer experienced with ReactFlow | Task: Integrate a collapsible EventDetailsPanel tied to graph selections and update dependency handling to use date-aware fields | Restrictions: Keep ReactFlow behavior performant, avoid breaking existing drag/connect UX, ensure keyboard accessibility | _Leverage: ui/lib/domain/planning-calendar.ts, ui/lib/state/planning-store.ts | _Requirements: Requirement 3, Non-Functional (Usability) | Success: Selecting nodes/edges opens editable panel, changes sync to graph/store, panel folds/expands smoothly | Instructions: Before starting change this task checkbox to [-] in tasks.md, after completing and validating change it to [x]._

- [x] 6. Convert Gantt chart to date-based axis and simplify controls
  - Files: ui/app/(planning)/components/gantt/GanttChart.tsx, ui/app/(planning)/components/gantt/useGanttData.ts, ui/tests/components/gantt/GanttChart.test.tsx (new)
  - 地平線の開始日を基準に日付ラベルを描画し、フィルタを廃止して横スクロール/ズームで全期間を確認できるようUIを簡素化する。
  - イベントマーカーのツールチップに実日付を表示し、180日程度を前提に描画パフォーマンスを維持する。
  - _Leverage: ui/lib/state/planning-store.ts, ui/lib/domain/planning-calendar.ts_
  - _Requirements: Requirement 1, Requirement 4, Performance
  - _Prompt: Implement the task for spec planning-ui-calendar-domain, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Data Visualization Engineer | Task: Update the Gantt chart rendering to operate on actual dates, remove redundant filters, and add unit tests for view-model formatting | Restrictions: Avoid heavy chart libraries, keep SVG rendering performant, ensure accessibility of tooltip text | _Leverage: ui/lib/state/planning-store.ts, ui/lib/domain/planning-calendar.ts | _Requirements: Requirement 1, Requirement 4, Performance | Success: Chart shows date labels, events display date tooltips, tests verify formatting & range calculations | Instructions: Before starting change this task checkbox to [-] in tasks.md, after completing and validating change it to [x]._

- [x] 7. Update request submission and validation flow for date-driven plan
  - Files: ui/app/(planning)/components/request-wizard/RequestWizard.tsx, ui/lib/validation/plan-schema.ts, ui/tests/request-wizard/RequestWizard.integration.test.tsx (new)
  - PlanFormStateの直接利用を廃止し、PlanningCalendarServiceの変換結果をAPI送信に使うようにリクエスト処理を更新する。
  - 日付入力のバリデーションエラーをユーザーへ明確に伝えるメッセージを追加し、ドラフト保存/ロードや実行成功・失敗の統合テストを整備する。
  - _Leverage: ui/lib/domain/planning-calendar.ts, ui/lib/state/planning-store.ts_
  - _Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Non-Functional (Reliability)
  - _Prompt: Implement the task for spec planning-ui-calendar-domain, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend Integration Engineer | Task: Rework RequestWizard submission to consume PlanningCalendarService output, improve validation messaging, and add integration tests | Restrictions: Keep API contract unchanged, avoid duplicate conversion logic, ensure loading states and errors remain responsive | _Leverage: ui/lib/domain/planning-calendar.ts, ui/lib/state/planning-store.ts | _Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Non-Functional (Reliability) | Success: Submission payload matches API schema, tests cover successful and failing runs, error UI guides users to fix inputs | Instructions: Before starting change this task checkbox to [-] in tasks.md, after completing and validating change it to [x]._
