# Requirements Document

## Introduction

FarmPLのプランニングUIではバックエンドAPIのスキーマ（日数カウント・配列入力）をそのまま露出しており、営農担当者が直感的に期間やイベントを扱いづらい状態である。本機能では計画期間や封鎖日、イベント条件などを日付ベースのUIに置き換え、農業者視点で理解しやすい操作体験を提供する。UI層では実日付を扱い、ドメイン層でAPIの日数表現へ変換することで、既存の最適化API互換性を保ちながらUXを改善する。

## Alignment with Product Vision

- product.mdで掲げる「解釈性優先」「現実性」に合致し、営農現場の暦ベースで計画を把握できるようにする。
- 段階的最適化や制約チューニングの操作性を高め、導入迅速化・ユーザー満足度向上の成功指標に寄与する。
- 疎結合モジュール方針を守り、フロントエンドのドメイン変換レイヤーを追加することでAPI変更を最小化する。

## Requirements

### Requirement 1

**User Story:** As a farm planner, I want to define the planning horizon with actual calendar dates so that I can align crop plans with real-world seasons without doing manual day-count conversions.

#### Acceptance Criteria

1. WHEN ユーザーが計画期間セクションで開始日と終了日をカレンダーから選択する THEN システムは開始日を保存し、期間日数を自動計算してUI上で表示する。
2. IF ユーザーが開始日を変更する THEN システムは既存の封鎖日・イベント条件・ガント表示の基準日をすべて再計算し、0起点の日数に矛盾がないように内部変換する。
3. WHEN ドラフトを保存・再ロードする THEN 保存時点の開始日・終了日・計算済み日数が復元され、UI上は日付で、API送信時には0起点日数へ確実に変換される。

### Requirement 2

**User Story:** As a farm planner, I want to manage land/worker/resource availability using intuitive date range controls so that I can block busy periods without risking manual entry mistakes.

#### Acceptance Criteria

1. WHEN 土地・作業者・リソースの封鎖設定を開く THEN UIは日付の複数選択や連続範囲を操作できるカレンダー／スライダーを提供し、カンマ区切りのテキスト入力は表示されない。
2. WHEN ユーザーが封鎖期間を確定する THEN ドメイン層は `{startDate, endDate}` または単日リストを0起点日数へ変換し、APIスキーマの配列に反映する。
3. IF ユーザーがオープンエンド（開始日もしくは終了日なし）オプションを選択する THEN システムは計画終了日までの範囲として扱い、API送信時には許容される最大日数に変換する。

### Requirement 3

**User Story:** As a farm planner, I want to configure event conditions and dependencies through the ReactFlow graph so that I can understand and edit the workflow constraints visually.

#### Acceptance Criteria

1. WHEN ユーザーがReactFlow上でイベントノードやエッジを選択する THEN 右側（またはモーダル）のイベント詳細パネルが折りたたみ可能なセクションとして開き、開始条件・終了条件・ラグ・要求リソースを編集できる。
2. WHEN ユーザーが接続エッジを編集・追加・削除する THEN ドメイン層は `precedingEventId` と関連する開始条件の最小日数を自動補正し、UIには日付で表示される。
3. IF ユーザーがロール・リソース・タグなどの配列項目を編集する THEN UIはチップ/バッジと追加用の入力フィールドで配列管理を行い、空配列時はundefinedに変換してAPIスキーマと整合する。

### Requirement 4

**User Story:** As a farm planner, I want the optimization results to show a date-based Gantt chart so that I can review and communicate the schedule on a real date axis.

#### Acceptance Criteria

1. WHEN 最適化結果が取得できた場合 THEN ガントチャートの横軸はUIで選択された開始日を基準とした実日付（YYYY-MM-DD）を表示し、ツールチップでも日付を示す。
2. IF 表示期間が画面幅を超える THEN ガントチャートは横スクロールまたはズーム操作で全期間を確認でき、従来の絞り込みフィルタは表示されない。
3. WHEN イベントマーカーにカーソルを合わせる THEN 対応するイベント名・作物名・対象土地・正確な日付がツールチップで表示される。

## Non-Functional Requirements

### Code Architecture and Modularity
- **Domain Conversion Layer**: UIとAPIの間に日付↔日数変換モジュールを設け、Reactコンポーネントからは日付型のみを扱う。
- **State Consistency**: 開始日変更時の再計算は単一のユーティリティに集約し、複数コンポーネントで同一ロジックを共有する。
- **Data Validation**: 変換後のデータは既存のZodスキーマを通過するよう、入力前に日数境界チェックを行う。

### Performance
- カレンダーやガント描画は90〜180日程度の期間で操作しても100ms以内で反応すること。

### Security
- 日付変換ロジックはクライアントサイドのみで完結し、機密情報を追加で保存しない。

### Reliability
- ドメイン変換に単体テストを追加し、同一入力が常に同じ日数配列を返すことを保証する。

### Usability
- カレンダー操作はモバイルでもタップしやすいUIコンポーネントを採用し、折りたたみセクションはARIA属性でアクセシビリティを確保する。
