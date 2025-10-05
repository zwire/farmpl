# Requirements Document

## Introduction

本ドキュメントでは、営農計画向けガントチャートUIの視覚表現を強化するための要件を整理する。土地×日付マトリクスのみだった表示を拡張し、作付けの視点や期間表現を柔軟に切り替えられるようにすることで、利用者が計画案を多面的に確認しやすくする。さらに、イベント表示の視認性と操作性を改善し、当日の作業内容を効率的に把握できる体験を提供する。

## Alignment with Product Vision

FarmPLの「解釈性優先」「現実性」の原則に沿い、同一の最適化結果を複数の観点から理解できるUIを実現する。役割ごとに必要な情報（圃場担当・作型担当・作業管理者）が視覚的に分かりやすくなることで、計画の調整と現場での実行性確認が容易となり、導入迅速化と満足度向上に寄与する。

## Requirements

### Requirement 1

**User Story:** As a planning manager, I want to toggle the Gantt matrix between land-based and crop-based rows so that I can analyze allocation trends from different perspectives.

#### Acceptance Criteria

1. WHEN ユーザーがガントチャートの表示モード切替UIで「作物×日付」を選択 THEN チャートは行を作物単位に並べ替え、列は現行のスケール設定を保持したまま再描画する。
2. IF モード切替後に最適化結果が未読み込みである THEN チャートは空状態カードを表示しつつ選択状態を保持する。
3. WHEN ユーザーがページを再訪または同セッション内でチャートを開く AND 直前に選択した表示モードが存在する THEN システムはそのモードを初期状態として適用する。

### Requirement 2

**User Story:** As an agronomy advisor, I want a seasonal date scale such as "3月上旬/中旬/下旬" to be available and default so that I can quickly grasp crop phases without細かな日付を数えることなく把握できる。

#### Acceptance Criteria

1. WHEN チャートが読み込まれる THEN 日付スケールは「旬（三分割）」単位を初期表示とし、各列ヘッダは月と旬区分（上旬/中旬/下旬）を表示する。
2. WHEN ユーザーがスケール選択UIで「日単位」を選択 THEN チャートは既存の日別スケールに切り替わり、列幅・ツールチップ・ヘッダ表示も同期して更新される。
3. IF 選択した期間が旬境界を跨いでいる THEN システムは開始日から終了日までの旬区分を連続して生成し、ツールチップでは厳密な日付範囲（開始日〜終了日）を提示する。

### Requirement 3

**User Story:** As a field supervisor, I want event markers to be rendered as color-coded badges aggregated by category so that I can quickly see workload types and inspect their details when needed.

#### Acceptance Criteria

1. WHEN ガントセルに複数イベントが存在する THEN システムはイベントカテゴリ（例: 種まき、収穫、資材投入）を自動判定し、カテゴリごとに色付きバッジを集約表示する。
2. IF 同一カテゴリに複数イベントが属する THEN バッジ内に件数を表示し、クリック時にモーダルまたはポップオーバーで詳細一覧（イベント名・日付・対象リソース等）を表示する。
3. WHEN カテゴリ名に基づくカラーコードが存在しない THEN システムはカテゴリ文字列のハッシュから安定的にカラーを算出し、WCAG AA相当のコントラストで前景色を決定する。

### Requirement 4

**User Story:** As a returning user, I want my chart preferences (view mode, scale type, event detail expansion) to persist so that I don’t need to reconfigure the chart each time.

#### Acceptance Criteria

1. WHEN ユーザーが表示モードやスケールを変更 THEN 設定はクライアント側ストア（例: Zustand）の軽量永続領域に保存される。
2. WHEN ページをリロードする THEN 直近保存された設定が復元され、チャート初期化処理に反映される。
3. IF 保存済み設定が失敗や破損で読み込めない THEN システムは安全なデフォルト（作物×日付、旬スケール）にフォールバックし、ユーザーへは不可視な形で処理する。

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: ビューモード、スケーリング、イベント整形ロジックをそれぞれ専用のフック/ユーティリティに分離し、UIコンポーネントの責務を明確化する。
- **Modular Design**: トグルUI、スケール生成、イベントカテゴリ計算を独立モジュールとして実装し、他画面への再利用を可能にする。
- **Dependency Management**: 既存の`usePlanningStore`や日付処理ユーティリティと整合しつつ、外部依存を追加しない。
- **Clear Interfaces**: 新規に導入する表示モードやカテゴリ型は型定義を`@/lib/types`配下に明示する。

### Performance
- 日付スケール計算やカテゴリ集約はメモ化し、レンダリング当たりの計算コストを現行同等以下に抑える。
- 追加UIによる初期描画時間増を50ms以内に制限することを目標とする。

### Security
- クライアント側に保存する設定情報は機密データを含まないことを確認する。

### Reliability
- ビュー切替・スケール切替・イベント詳細表示はいずれもエラー時に静かにフォールバックし、チャート全体のクラッシュを防ぐ。

### Usability
- トグルやバッジはキーボード操作とスクリーンリーダー対応を行い、ARIA属性で状態を明示する。
- 色覚多様性を考慮し、バッジ色のみで意味が伝わらないようアイコンやテキストも併用する。

