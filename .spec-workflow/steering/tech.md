# Technology Stack

## Project Type
API/最適化エンジン（CLIデモ有り）。将来はFastAPIによるAPIサービス化とWebダッシュボード連携を予定。

## Core Technologies

### Primary Language(s)
- **Language**: Python 3.13+
- **Runtime/Tools**: uv（パッケージ管理）、pytest、ruff

### Key Dependencies/Libraries
- **OR-Tools (>=9.14)**: CP-SAT ベースの最適化
- **Pydantic v2**: スキーマ定義・型バリデーション
- **typing-extensions**: 型補助

### Application Architecture
- モノレポ内の `api/` 配下に最適化コアとCLIを配置
- 疎結合な制約モジュール（`api/lib/constraints/*`）＋ビルダー（`model_builder`）＋ソルバー（`solver`）構成
- 目的関数は段階的（lexicographic）に実行（`planner`）

### Data Storage
- 永続ストレージなし（計算はメモリ内）。将来、結果のJSON出力やDB永続化を検討。
- データ形式: Pythonオブジェクト / JSON（将来）

### External Integrations
- 現状なし。将来は気象・価格API、社内DB等との連携を想定。
- プロトコル: HTTP/REST（API化後）、CLI I/O

### Monitoring & Dashboard Technologies
- まずはCLI出力（表形式）。将来、Web UI（React or Vue）＋SSE/WS でリアルタイム表示。

## Development Environment

### Build & Development Tools
- **Package Management**: uv
- **Development workflow**: CLIでの高速実行、単体テスト駆動

### Code Quality Tools
- **Static Analysis**: Ruff（flake8-bugbear, pyupgrade, comprehensions 等有効）
- **Formatting**: Ruff format（line-length=88, target=py313）
- **Testing Framework**: Pytest（`api/tests/*`）
- **Documentation**: `api/docs/*` に運用・モデル仕様を保存

### Version Control & Collaboration
- VCS: Git（ブランチ戦略は任意だが、PR単位での小さな変更を推奨）

### Dashboard Development (future)
- ホットリロード: Vite/Next 等を検討
- ポート管理: 環境変数で可変
- 複数インスタンス: APIとダッシュボードは疎結合運用

## Deployment & Distribution
- Target: ローカル/コンテナ（`.devcontainer`あり）。将来はAPIサービスとしてデプロイ。
- Distribution: Git/コンテナイメージ
- Installation Requirements: Linux, Python 3.13+, uv
- Update Mechanism: Git pull/イメージ更新

## Technical Requirements & Constraints

### Performance Requirements
- 小〜中規模問題で数十秒以内（目安）。大規模は段階的に制約/粒度調整。

### Compatibility Requirements
- Platform: Linux（開発環境準拠）
- Dependency Versions: `pyproject.toml` に準拠

### Security & Compliance
- 当面ローカル実行。API化時は認証・レート制限・監査ログを導入。

### Scalability & Reliability
- 計算負荷は問題サイズに比例。時間窓導入時はスケール戦略（粗→細）で段階実行。

## Technical Decisions & Rationale
1. **OR-Tools/CP-SAT 採用**: 離散制約が多く、CP-SATが適合。インジケータ制約で大M回避。
2. **疎結合制約モジュール**: ON/OFFと単体テスト容易性のため。
3. **Lexicographic 最適化**: 優先度の明確化と解釈性のため。
4. **uv + Ruff + Pytest**: 近代的で軽量なPython開発環境の標準化。

## Known Limitations
- 役割厳密化・h時間窓は未実装（ロードマップ済）
- JSON I/O/API サーバは未実装
- 大規模問題では解の探索時間が増加する可能性