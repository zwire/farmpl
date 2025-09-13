# コマンド使用ガイド

FarmPL デモ用 CLI は `api/main.py` にあります。`uv` 経由で実行します。

## 前提
- プロジェクトルートで実行
- 実行は `uv` を使用

## 基本コマンド
- `api/main.py`
  - 既定は2段（profit→dispersion）の計画を実行し、日別の面積・アイドル・イベント割当を表示します。

例:
- 実行: `cd api && uv run python main.py`

## plan サブコマンド（計画の実行）
- 形式: `cd api && uv run python main.py plan [--extra STAGE ...] [--stages LIST] [--lock-tol PCT] [--json]`

オプション:
- `--extra STAGE`
  - 既定の2段（profit→dispersion）の後ろに段を追加。
  - 利用可能: `labor`（労働最小）, `idle`（遊休最小）, `diversity`（品目数最大）
  - 例: `--extra labor --extra idle`
- `--stages LIST`
  - 段階の順序をカンマ区切りで完全指定。
  - 既定の profit, dispersion の固定を外し、与えた順で最適化します。
  - 利用可能: `profit`, `dispersion`, `labor`, `idle`, `diversity`
  - 例: `--stages profit,dispersion,labor`
- `--lock-tol PCT`
  - 前段の最適値ロックに許容誤差（パーセンテージ）を与えます。
  - `PCT` は百分率。例: `--lock-tol 5` は ±5% を許容
    - Max（例: profit）は下限を (1−PCT%) に緩和
    - Min（例: dispersion）は上限を (1＋PCT%) に緩和
  - 例: `--stages profit,dispersion,labor --lock-tol 10`
- `--json`
  - 予約（将来の JSON 出力用）。現状は表示形式に影響しません。

使用例:
- 既定（2段）: `cd api && uv run python main.py plan`
- 労働最小を3段目に追加: `cd api && uv run python main.py plan --extra labor`
- 完全指定＋10%許容: `cd api && uv run python main.py plan --stages profit,dispersion,labor --lock-tol 10`

## compare サブコマンド（段階比較のデモ）
- 形式: `cd api && uv run python main.py compare [--json]`
- 出力内容:
  - `two_stage`: profit→dispersion の結果
  - `three_stage_labor`: profit→dispersion→labor の結果
  - `three_stage_idle`: profit→dispersion→idle の結果
  - `three_stage_diversity`: profit→dispersion→diversity の結果
- `--json`: JSON 形式での出力（簡易）。

## ステージの意味（目的関数）
- `profit`（max）: 収益最大化（price×面積の合計）
- `dispersion`（min）: 区画×品目の散らばりを抑制（z[l,c] の総和）
- `labor`（min）: 総労働時間最小化（Σ h[w,e,t]）
- `idle`（min）: 遊休面積最小化（Σ idle[l,t]）
- `diversity`（max）: 採用品目数最大化（use_c の総和、z と連動）

## 補足
- `--stages` 指定時は `--extra` は無視されます。
- `--lock-tol` を指定しない場合は完全ロック（前段の最適値を厳密維持）。
- サンプルデータは `api/demo/sample.py` の `build_sample_request()` で定義。

## サンプルコマンド集（ケース別）
- 既定の2段で実行（profit→dispersion）:
  - `cd api && uv run python main.py plan`
- 3段目に労働最小を追加（既定順に末尾追加）:
  - `cd api && uv run python main.py plan --extra labor`
- 3段目と4段目に遊休最小・多品目最大を追加:
  - `cd api && uv run python main.py plan --extra idle --extra diversity`
- 完全に順序を指定（profit→dispersion→labor）:
  - `cd api && uv run python main.py plan --stages profit,dispersion,labor`
- 完全順序＋前段ロックを10%緩和（許容誤差）:
  - `cd api && uv run python main.py plan --stages profit,dispersion,labor --lock-tol 10`
- 分散の前に多品目最大を入れる（例: profit→diversity→dispersion）:
  - `cd api && uv run python main.py plan --stages profit,diversity,dispersion`
- 比較デモ（2段・3段の結果をまとめて出力）:
  - `cd api && uv run python main.py compare`
- 比較デモをJSONで受け取りたい場合:
  - `cd api && uv run python main.py compare --json`
