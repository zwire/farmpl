# Requirements Document

## Introduction
FarmPL営農プランニングAPIを活用し、Next.jsベースのフロントエンドを構築する。
ユーザーが営農計画リクエストの作成・送信・進捗監視・結果解釈・エクスポートをブラウザ上で完結できるようにし、ガントチャートとメトリクス可視化により現場での意思決定を支援する。

## Alignment with Product Vision
本UIはproduct.mdで掲げる「解釈性優先」「現実性」を体現し、APIで生成される最適化結果を現場担当者が理解・再調整できる形で提示する。
段階的最適化の結果を視覚化し、制約ヒントやリソースボトルネックを即座に把握できるようにすることで、FarmPLの導入迅速化と可行率向上というビジネス目標を後押しする。

## Requirements

### Requirement 1
**User Story:** 営農計画担当者として、最適化リクエストをUIで作成・編集し、APIスキーマに準拠した入力を簡単に整えたい。そうすることで、プラン定義の試行錯誤をコード編集なしで行える。

#### Acceptance Criteria
1. WHEN ユーザーが「新規リクエスト」を開始したとき THEN UI SHALL ステップ型フォームで `horizon`・`crops`・`events`・`lands`・`workers`・`resources`・各種制約設定を入力できるように導く。
2. IF 入力値が `OptimizationRequest.plan` スキーマのバリデーションに失敗した場合 THEN UI SHALL エラー箇所と理由を項目ごとに表示し、保存や送信をブロックする。
3. WHEN ユーザーが既存のリクエストを編集するために保存済みドラフトを選択したとき THEN UI SHALL 最新の入力内容をフォームに復元し、再バリデーション結果をリアルタイムに反映する。

### Requirement 2
**User Story:** 営農計画担当者として、作成したリクエストを同期/非同期の両モードでAPIに送信し、進捗やジョブ状態を把握したい。そうすることで長時間計算でも安全に管理できる。

#### Acceptance Criteria
1. WHEN ユーザーがリクエスト送信を選択したとき THEN UI SHALL 非同期(`/v1/optimize/async`)のAPIを使う。
2. UI SHALL 返却された `job_id` を保存し、一定間隔で `/v1/jobs/{job_id}` をポーリングしてステータスと進捗率を更新表示する。
3. WHEN ジョブが `failed`・`timeout`・`canceled` のいずれかになったとき THEN UI SHALL 失敗理由・推奨アクション（例: 入力見直し、再送信）を含む通知を表示する。

### Requirement 3
**User Story:** 営農計画担当者として、最適化結果のステータス・目的関数値・統計・制約ヒントを可視化し、意思決定に必要なメトリクスを理解したい。そうすることで、結果の妥当性や改善余地を素早く判断できる。

#### Acceptance Criteria
1. WHEN API応答に `OptimizationResult` が含まれるとき THEN UI SHALL ステータス・`objective_value`・`stats.stages`・`stats.stage_order`・`solution.summary` をカード形式で表示する。
2. IF `solution.constraint_hints` が存在する場合 THEN UI SHALL 各ヒントを優先度順にリスト表示し、該当する入力セクションへのジャンプ導線を提供する。
3. WHEN 結果ステータスが `infeasible` または `timeout` のとき THEN UI SHALL 警告モジュールで原因を強調し、再計算用の入力変更案を提示する。

### Requirement 4
**User Story:** 営農計画担当者として、ガントチャートで土地占用とイベントスケジュールを確認したい。そうすることでリソース競合や遊休期間を視覚的に把握できる。

#### Acceptance Criteria
1. WHEN `OptimizationResult.timeline.land_spans` が提供されるとき THEN UI SHALL 土地×期間を横軸日数・縦軸土地IDで表示し、作物別に色分けされた帯で可視化する。
2. IF ユーザーが特定の作物・土地・期間をフィルタリングした場合 THEN UI SHALL ガントチャートとイベント一覧を同期して該当データのみを表示する。
3. WHEN ユーザーがチャート上の区間をクリックしたとき THEN UI SHALL 詳細パネルで面積・期間・関連イベント・必要リソースを表示する。

## Non-Functional Requirements

### Code Architecture and Modularity
- Next.js App Routerを前提に、フォーム・可視化・APIクライアントを独立コンポーネントとして分割する
- 入力バリデーションは専用ユーティリティに集約し、再利用性とテスト容易性を高める
- 状態管理は軽量なシグナルまたはステートマシンを用いて、副作用と表示ロジックを明確に分離する
- APIクライアント層ではリトライ・ポーリング・キャンセル制御を共通モジュール化する

### Performance
- フォーム入力は50フィールド程度でも100ms以内にバリデーション結果を返す
- ジョブポーリングはユーザー設定に応じて3〜15秒間隔で行い、不要時は停止できる
- ガントチャートは30土地×180日規模でも初期描画500ms以内・インタラクション応答100ms以内を目標とする

### Security
- APIキー/ベアラートークンは環境変数経由で安全に注入し、クライアント側ではセッションストレージなどに平文保存しない
- HTTPS通信前提での利用を明記し、CORS設定はAPI側のホワイトリストに従う
- エラーメッセージに機密情報（内部ID・スタックトレース）を含めない

### Reliability
- API呼び出し失敗時は指数バックオフ付きリトライ（最大3回）と手動再試行導線を提供する
- ブラウザリロード時に編集中のフォーム内容をローカルにバックアップし、復元可にする
- ポーリング停止やタイムアウト時にはユーザー通知し、ジョブ履歴からいつでも再取得できるようにする

### Usability
- 入力フォームではセクションごとの概要説明・ツールチップを提供し、農業ドメイン用語を補足する
