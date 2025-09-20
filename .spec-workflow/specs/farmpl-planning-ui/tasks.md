# Tasks Document

- [x] 1. 画面・API共通の型定義を作成する
  - File: ui/lib/types/planning.ts
  - 内容: OptimizationRequestのplan構造、OptimizationResult、JobInfo、タイムライン表示用モデルをTypeScriptのインターフェース/enumとして定義する。
  - 目的: UI全体で再利用できる型を用意し、API入出力との整合性を保証する。
  - _Leverage: api/schemas/optimization.py, ui/tsconfig.json_
  - _Requirements: 1, 3_
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript domain model engineer | Task: Author TypeScript domain models in ui/lib/types/planning.ts covering request form, API responses, and timeline structures per requirements 1 and 3 | Restrictions: Do not generate types automatically at runtime, keep file focused on type exports only, ensure naming aligns with schema casing | _Leverage: api/schemas/optimization.py, ui/tsconfig.json | _Requirements: 1, 3 | Success: Type definitions compile, match schema fields, and are imported by downstream modules without circular refs_

- [x] 2. Zodベースのバリデーションエンジンを実装する
  - File: ui/lib/validation/plan-schema.ts
  - 内容: OptimizationRequest.planを模したZodスキーマと単位変換ヘルパーを実装し、クロスフィールド検証を行う。
  - 目的: RequestWizardや送信処理で使い回せる入力チェック基盤を提供する。
  - _Leverage: ui/lib/types/planning.ts, api/schemas/optimization.py_
  - _Requirements: 1, Non-Functional (Code Architecture, Performance)
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend validation specialist | Task: Build Zod schemas and helper functions validating planning requests per requirement 1 and non-functional validation rules | Restrictions: Keep pure functions without React hooks, surface typed error maps, include unit conversion helpers | _Leverage: ui/lib/types/planning.ts, api/schemas/optimization.py | _Requirements: 1, NF-Code Architecture | Success: Validation passes design scenarios, reports granular errors, unit tests (added later) can import schema_

- [x] 3. リクエストウィザードUIを構築する
  - Files: ui/app/(planning)/components/request-wizard/*.tsx, ui/app/(planning)/page.tsx
  - 内容: Horizon/Crops/Events/Lands/Workers/Resources/Constraintsの各ステップを持つマルチステップフォームを作り、バリデーションやドラフト保存を組み込む。
  - 目的: ユーザーがGUI上で計画リクエストを作成・編集できるようにする。
  - _Leverage: ui/lib/validation/plan-schema.ts, ui/lib/types/planning.ts, Tailwind CSS_
  - _Requirements: 1, 4.2 (filter integration), Usability
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Senior React form engineer | Task: Deliver the RequestWizard component suite providing stepper navigation, inline validation, and draft loading per requirements 1 and usability goals | Restrictions: Use server-safe Next.js App Router patterns, keep components client-side where needed, ensure accessibility semantics | _Leverage: ui/lib/validation/plan-schema.ts, Tailwind CSS utilities | _Requirements: 1, 4 | Success: Wizard renders across breakpoints, validation errors surface contextually, drafts load/save correctly_

- [x] 4. プランニング用状態ストアと永続化を実装する
  - File: ui/lib/state/planning-store.ts
  - 内容: Zustand等を用いてフォーム状態・ドラフトメタデータ・派生値を管理し、ローカルストレージへの永続化とSSR安全な初期化を整える。
  - 目的: ウィザードや送信・結果表示が共有できる集中管理された状態を提供する。
  - _Leverage: ui/lib/types/planning.ts, ui/lib/validation/plan-schema.ts_
  - _Requirements: 1, Reliability
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend state management specialist | Task: Build a typed planning store with hydration guards and persistence hooks per requirement 1 and reliability NFR | Restrictions: Avoid direct window access during SSR, expose selectors/hooks for consumer components, include reset utilities | _Leverage: Zustand (add to package.json), ui/lib/types/planning.ts | _Requirements: 1, NF-Reliability | Success: Store initializes safely server/client, persistence toggles work, consumers can subscribe to slices without leaks_

- [x] 5. 結果ダッシュボードコンポーネントを構築する
  - Files: ui/app/(planning)/components/result-dashboard/*.tsx
  - 内容: ステータス・目的値・ステージ統計・制約ヒントをカード/リスト形式で表示し、入力セクションへのスクロール連携を実装する。
  - 目的: OptimizationResultを分かりやすく提示し、要件3を満たす。
  - _Leverage: ui/lib/types/planning.ts, ui/lib/state/planning-store.ts_
  - _Requirements: 3
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Data visualization-focused frontend engineer | Task: Build result dashboard components rendering metrics, stage summaries, and constraint hints per requirement 3 | Restrictions: Ensure responsive card grid, accessible messaging, avoid expensive recomputations | _Leverage: Tailwind CSS, formatting utilities | _Requirements: 3 | Success: Dashboard adapts to result status, hints link to input sections, cards readable on mobile_

- [x] 6. ガントチャート可視化モジュールを実装する
  - Files: ui/app/(planning)/components/gantt/GanttChart.tsx, ui/app/(planning)/components/gantt/useGanttData.ts
  - 内容: 土地の占用期間とイベントを色分け帯・マーカーで表現し、フィルターやツールチップ、キーボードフォーカスを備えたインタラクティブガントを作成する。
  - 目的: 要件4の可視化要望（ガント表示とフィルタリング）に応える。
  - _Leverage: ui/lib/types/planning.ts, @visx/rect, @visx/axis_
  - _Requirements: 4
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React data viz engineer | Task: Produce an interactive gantt chart with filters and tooltips for land spans/events per requirement 4 | Restrictions: Keep rendering performant (virtualize >200 bars), respect theme colors, ensure keyboard focus support | _Leverage: visx library, ui/lib/types/planning.ts | _Requirements: 4 | Success: Chart responds to filters, tooltips show details, renders within performance targets_

- [x] 7. メトリクス可視化とエクスポート機能を追加する
  - Files: ui/app/(planning)/components/metrics/MetricsCharts.tsx, ui/lib/export/export-utils.ts
  - 内容: 目的関数やリソース利用のチャートを描画し、結果JSON/CSVおよび入力テンプレートJSONのエクスポートを実装する。
  - 目的: 要件3と要件5で求められる分析表示とデータ共有を支援する。
  - _Leverage: ui/lib/types/planning.ts, ui/lib/state/planning-store.ts, d3-array_
  - _Requirements: 3, 5
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: UX engineer focused on analytics tooling | Task: Deliver metrics charts and export utilities meeting requirements 3 and 5 | Restrictions: Keep exports client-side, ensure CSV headers documented, provide download feedback | _Leverage: FileSaver.js (add dependency), ui/lib/types/planning.ts | _Requirements: 3, 5 | Success: Charts render key metrics, exports trigger downloads with success/error toasts_

- [x] 8. レイアウトとテーマシステムを整備する
  - Files: ui/app/layout.tsx, ui/app/globals.css, ui/lib/ui/theme-provider.tsx
  - 内容: PlannerShellレイアウト、ブレークポイント対応グリッド、ライト/ダークテーマ切替、共通カード/パネルスタイルを実装する。
  - 目的: モダンでレスポンシブなUI基盤を提供し、可読性と使いやすさを向上させる。
  - _Leverage: Tailwind CSS, CSS variables, design document architecture diagram_
  - _Requirements: 4, Usability
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend UI systems engineer | Task: Build layout scaffolding, responsive grids, and theme management matching design goals and requirement 4 usability | Restrictions: Preserve Next.js metadata setup, avoid global style regressions, provide motion-reduced fallbacks | _Leverage: Tailwind CSS, prefers-color-scheme media query | _Requirements: 4, NF-Usability | Success: Layout adapts to screen sizes, theme toggle persists preference, components share consistent visuals_

- [ ] 9. ユニットテストと統合テストを作成する
  - Files: ui/tests/unit/validation.test.ts, ui/tests/unit/api-client.test.ts, ui/tests/integration/request-flow.test.tsx
  - 内容: Vitest/Testing Library/MSWを用いてバリデーション、APIクライアントのリトライ、送信フローの成功/失敗パターンを検証する。
  - 目的: 要件1〜3の中核ロジックの正しさを自動テストで担保する。
  - _Leverage: vitest, @testing-library/react, msw_
  - _Requirements: 1, 2, 3
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend QA engineer | Task: Create unit/integration tests covering validation, API client, and submission panels per requirements 1-3 | Restrictions: Use MSW for network mocks, keep tests deterministic, follow existing testing conventions | _Leverage: setupTests.ts (create if missing), vitest config | _Requirements: 1, 2, 3 | Success: Tests pass locally, cover failure paths, run quickly in CI_

- [ ] 10. PlaywrightによるE2Eシナリオを実装する
  - Files: ui/tests/e2e/planning.spec.ts, ui/tests/e2e/fixtures/*.ts
  - 内容: ドラフト作成→非同期送信→結果閲覧→エクスポート→バリデーションエラー表示をモバイル/タブレット/デスクトップ各ビューポートで自動化する。
  - 目的: ユーザーフロー全体とレスポンシブ挙動をE2Eで検証する。
  - _Leverage: Playwright, design document testing strategy_
  - _Requirements: All
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: E2E automation specialist | Task: Script Playwright tests covering end-to-end planning UI journeys per full requirements set | Restrictions: Keep tests resilient (data-testids), include viewport tests for mobile/tablet/desktop, avoid flakiness | _Leverage: Playwright test runner, msw server mocks | _Requirements: 1, 2, 3, 4, 5 | Success: E2E suite runs succeeding, covers exports and gantt interactions, integrates with CI reports_

- [ ] 11. 最終統合とドキュメント整備を行う
  - 内容: すべてのコンポーネントを統合し、クロスモジュール依存を整理、READMEや設計ドキュメントを最新化する。ビルド・Lint・テストを通過させる。
  - 目的: リリース可能なUIとして完成度を高める。
  - _Leverage: ui/README.md, design document, 前タスク成果物_
  - _Requirements: All
  - _Prompt: Implement the task for spec farmpl-planning-ui, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Senior frontend integrator | Task: Polish and integrate the full planning UI, update documentation, and verify responsiveness per full requirement set | Restrictions: Do not regress tests, keep bundle size reasonable, ensure lint/build pass | _Leverage: npm scripts, docs, design.md | _Requirements: 1, 2, 3, 4, 5 | Success: Build succeeds, lint/tests clean, documentation reflects current behavior_
