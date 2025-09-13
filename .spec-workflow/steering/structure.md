# Project Structure

## Directory Organization

```
/workspace
├── api/                   # 最適化コアとCLI
│  ├── lib/               # ドメイン/最適化ロジック
│  │  ├── constraints/    # 各種制約モジュール（疎結合でON/OFF可能）
│  │  ├── model_builder.py
│  │  ├── objectives.py
│  │  ├── planner.py
│  │  ├── solver.py
│  │  ├── variables.py
│  │  ├── diagnostics.py
│  │  ├── interfaces.py
│  │  └── schemas.py
│  ├── demo/              # デモ/サンプル・表示ユーティリティ
│  ├── tests/             # 単体テスト（pytest）
│  ├── docs/              # 技術・モデル・コマンドドキュメント
│  ├── main.py            # CLIエントリ（plan/compare）
│  ├── pyproject.toml     # 依存・ツール設定
│  └── README.md
├── .spec-workflow/       # スペック/ステアリング生成物
│  └── steering/          # product.md / tech.md / structure.md
├── .cursor/              # 開発ルール（MDC）
├── .devcontainer/        # DevContainer 設定
└── .vscode/              # エディタ設定
```

## Naming Conventions

### Files
- **ライブラリ/モジュール**: `snake_case`
- **クラス**: `PascalCase`（ファイルは用途に応じて分割）
- **テスト**: `test_*.py`

### Code
- **Classes/Types**: PascalCase
- **Functions/Methods**: snake_case
- **Constants**: UPPER_SNAKE_CASE
- **Variables**: snake_case

## Import Patterns

### Import Order
1. 標準ライブラリ
2. サードパーティ
3. ローカルモジュール（`from lib...` / `from demo...`）

### Module/Package Organization
- `api/lib` はドメイン層（スキーマ/変数/制約/目的/ビルド/ソルブ）
- `api/demo` は表示/サンプル・ユースケース
- `api/main.py` はCLIのみ（将来APIができれば分離）

## Code Structure Patterns

### Module/Class Organization
1. インポート
2. 定数・設定
3. 型・スキーマ
4. 実装（制約・目的・ソルバー）
5. ヘルパー
6. 公開API

### Function/Method Organization
- 先に入力バリデーション
- 中央に中核ロジック
- 例外は適切に境界層で処理
- 早期returnで分岐を浅く

### File Organization Principles
- 1ファイル1責務を基本に、密接関連のみ同居
- 公開APIは明示し、内部実装は隠蔽

## Code Organization Principles
1. 単一責任
2. モジュール性
3. テスタビリティ
4. 一貫性（Ruff/型/Docstring）

## Module Boundaries
- **Core vs Demo**: `lib` がコア、`demo` はUI/表示補助
- **Public vs Internal**: `schemas.py`/`interfaces.py` を公開面、細目は内部
- **Stable vs Experimental**: `demo`/`docs` で検証、コアへ段階的移行
- **Dependencies direction**: `demo`→`lib` 依存、逆依存は禁止

## Code Size Guidelines
- **File size**: ~400行以下推奨（超える場合は分割検討）
- **Function size**: 40-60行目安
- **Nesting depth**: 2-3レベル以内

## Dashboard/Monitoring Structure (future)
```
src/
└── dashboard/
    ├── server/
    ├── client/
    ├── shared/
    └── public/
```
- ダッシュボードはコアから独立。専用エントリ/依存の最小化。

## Documentation Standards
- 公開API・複雑ロジックはドキュメント必須
- `api/docs/*` に仕様/モデル/コマンドを集約
- Docstring はGoogleスタイル、例・型を明示