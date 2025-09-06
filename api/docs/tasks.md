# 実装タスクチェックリスト

以下は、docs仕様（model.md / tech.md / draft.md）を実装へ反映し、最小→完成へ到達するための実行用タスクリスト。各タスクは完了時に [x] へ更新。制約は「実装・テスト・サンプルデータ更新」をセットで行う。

## 0. 基盤・共通
- [x] `lib/` 骨格の整備（schemas, interfaces, builder, solver, diagnostics, planner）
- [x] OR-Tools 導入と最小モデル（x,z, 2制約, 2段階目的）
- [x] `plan()` 二段階最適化（利益→分散）
- [x] 単体テスト基盤（pytest, `uv run pytest`）
- [x] 最小サンプルデータでの動作

## 1. 変数・スケール・モデル方針
- [x] 面積スケール（unit=0.1a）を定数化し、全体で統一
- [x] 時間軸（T）拡張へ備えた変数設計（現状は x[l,c]、将来 x[l,c,t]）の整理メモ
  - [x] 完全版: x[l,c,t] と idle[l,t] へ移行

## 2. 制約（Constraints）実装とテスト
各制約は ON/OFF 可能な独立コンポーネントとして実装し、以下を1セットで行う：
- 実装（`lib/constraints/*.py` 追加）
- `__init__.py` に記述追加
- 単体テスト（`tests/` に test_*.py 追加）
- サンプルデータ拡張（`main.py` または専用fixture）

2.1 土地面積制約（日次版）
- [x] Sum_c x[l,c,t] <= area_l（実装済み）
- [x] テスト: ちょうど上限まで使うケース

2.2 面積と採用二値のリンク（日次版）
- [x] x[l,c,t] <= area_l * z[l,c]（実装済み）
- [x] テスト: z=0 で x>=1 を課すと infeasible

2.3 事前割付（fixed_area[l,c] の下限）
- [x] 実装: Sum_t x[l,c,t] >= fixed_area[l,c]
- [x] テスト: 満たす/不可能ケース
- [ ] サンプル更新: 一部 land-crop に fixed を付与

2.4 作物面積の上下限（area_min_c, area_max_c）
- [x] 実装: area_min_c <= Sum_{l,t} x[l,c,t] <= area_max_c
- [x] テスト: min/max を満たす組合せで可否を確認
- [ ] サンプル更新: 片方に最小、片方に最大を設定

2.5 労働需要と作業者容量（通算+日次上限）
- [x] 実装: 通算充足 Σ_t Σ_w h[w,e,t] >= total_need_e
- [x] 実装: 日次上限 Σ_w h[w,e,t] <= labor_daily_cap_e · r[e,t]
- [ ] 実装: 所要人数下限と assign 連動（r[e,t]でインジケータ化）
- [x] テスト: 容量超過で infeasible、余裕で feasible（基本）
- [ ] サンプル更新: workers に capacity、events に labor_total_per_area と labor_daily_cap を設定

2.6 必須役割の充足（assign と role のリンク）
- [ ] 実装: 役割 q ごとに Sum_w role_has[w,q] * assign[w,e,(t)] >= 1
- [ ] テスト: 役割不在で infeasible、役割あると feasible
- [ ] サンプル更新: workers に roles を設定

2.7 リソース容量と必要イベント供給
- [x] 実装: Sum_e u[r,e,t] <= cap_r、実施日には Σ_r u[r,e,t] >= Σ_w h[w,e,t]
- [x] テスト: 基本ケース
- [ ] サンプル更新: resource を1つ追加

2.8 土地・作業者・リソースの利用禁止期間（日次）
- [x] 実装: land→x=0、worker→h=0、resource→u=0
- [ ] テスト: 禁止設定が反映される
- [ ] サンプル更新: いずれかに blocked 設定

2.9 収穫能力とピーク超過
- [x] 実装: Σ_c harv[c,t] <= harvest_cap[t] + over[t]、harv[c,t] <= Σ_l x[l,c,t]
- [x] テスト: cap を超えないこと
- [ ] サンプル更新: harvest_cap を与える

2.10 アイドル（遊休）日次版
- [x] 実装: Sum_c x[l,c,t] + idle[l,t] = area_l
- [x] テスト: idle が非負で帳尻が合う
- [ ] サンプル更新: 出力に idle を可視化

2.11 イベント依存（頻度・ラグ）
- [x] 実装: frequency_days の間隔制約
- [x] 実装: preceding_event_id のラグ制約（Lmin/Lmax）
- [x] テスト: 基本ケース

## 3. 目的関数（Objectives）
3.1 収益最大化（既存）
- [x] 実装・評価済み

3.2 分散最小化（既存）
- [x] 実装・評価済み

3.3 労働時間最小化（雛形）
- [ ] 実装: Sum h[w,e,(t)] を最小化（時間なしの簡略版）
- [ ] テスト: 労働負荷の小さい解が選ばれる

3.4 ピーク超過最小化（雛形）
- [ ] 実装: Sum over_t を最小化（総量制約からの拡張）
- [ ] テスト: over_t が減る方向へ

3.5 多品目志向（Diversity）または単一志向
- [ ] 実装: use_c（二値）導入し項を追加（最大/最小）
- [ ] テスト: 多様性重みで解が変わること

3.6 段階的最適化（lexicographic）
- [x] 1段目 Profit → 2段目 Dispersion
- [ ] 追加段のオプション（労働・ピーク等）を選択的に有効化

## 4. API・I/O・診断
- [ ] `PlanResponse` に目的値・制約評価の要約を追加
- [ ] Diagnostics 拡張: infeasible 時に候補ネックを出す（簡易）
- [ ] `main.py` サンプル拡張: workers/resources/fixed/area bounds を設定して再実行例

## 5. ドキュメント整備
- [x] `docs/model.md` との乖離チェックと差分反映（イベント労働仕様を更新済み）
- [ ] `docs/tech.md` の「時間窓(h)」設計メモの反映（将来計画）
- [ ] `README.md` に実行方法（uv sync / uv run pytest / python main.py）追記


