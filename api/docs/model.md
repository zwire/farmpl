# 営農プランニング数理モデル（OR-Tools 実装指針付き）

本ドキュメントは OR-Tools（CP-SAT または線形最適化）で実装可能な数理モデルを定義する。

集合・パラメータ・決定変数・制約・目的関数を記す。離散決定（スケジューリング、整数割当）が多いため、基本は CP-SAT（0-1 整数）を利用し、連続近似が妥当な箇所のみ線形実数を併用するハイブリッド方針とする。

## 1. 集合（Sets）
- 作物集合: $C$
- イベント集合: $E$（各イベントは対象作物を持つ）
- 土地（圃場）集合: $L$
- 作業者集合: $W$
- 共有リソース集合（機械等）: $R$
- 日集合（計画期間の各日）: $T = {1, ..., |T|}$
- 役割集合: $Q$

補助集合（イベント種別）:
- 単発イベント集合: $E_{one} \subseteq E$
- 繰り返しイベント集合: $E_{rep} \subseteq E$
- 持続型イベント集合: $E_{sus} \subseteq E$

## 2. パラメータ（Parameters）
- 作物単価（円/a）: $price_c (c \in C)$
- 土地面積（a）: $area_l (l \in L)$
- イベント対象作物: $crop_e \in C (e \in E)$
- イベントカテゴリ（播種・定植・散水・収穫等）: $cat_e (e \in E)$（実装では列挙/ID）
- イベント所要人数（人）: $people\_req_e (e \in E)$
- イベント日次労働需要（h/a/日）: $labor\_per\_area_e (e \in E)$
- 必須役割リスト: $roles\_req_e \subseteq Q (e \in E)$（空集合可）
- 共有リソース必要リスト: $resources\_req_e \subseteq R (e \in E)$（空集合可）
- 作物面積上下限制約（任意）: $area\_min_c, area\_max_c (c \in C)$（未設定時は $0, +\infty$）
- 土地の事前割付（任意）: $fixed\_area_{lc} \ge 0 (l \in L, c \in C)$（未設定は $0$）
- 土地・作業者・共有リソースの利用禁止期間（任意）:
  - $land\_blocked_{l,t} \in {0,1}$
  - $worker\_blocked_{w,t} \in {0,1}$
  - $resource\_blocked_{r,t} \in {0,1}$
- 作業者上限作業時間（h/日）: $worker\_cap_w (w \in W)$
- イベント実施可能期間/条件:
  - 単発: $window_e \subseteq T$
  - 繰り返し: $start\_cond_e \subseteq T, end\_cond_e \subseteq T, freq_e \in Z_{\gt0}$
  - 持続: $start\_window_e \subseteq T, dur_e \in Z_{\gt0}$
- 収穫能力（h/日 または a/日）: $harvest\_cap_t (t \in T)$（能力制約の基準値）
- 多様性・嗜好の重み（ユーザー設定）: $w_{profit}, w_{labor}, w_{idle}, w_{dispersion}, w_{peak}, w_{diversity}$（正の重み）

補助パラメータ：
- 面積→労働時間換算: $labor_e(a) = labor\_per\_area_e * a$
- 大M定数: $M$（十分大きい値、CP-SAT ではインジケータ制約で代替推奨）

## 3. 決定変数（Decision Variables）
- 面積配分: $x_{l,c,t} \ge 0$（日 $t$ に土地 $l$ で作物 $c$ として占有する面積 $a$）
  - 備考: 作付けの時空間連続性を簡略化したい場合は $t$ 非依存の $x_{l,c}$ にし、イベントにより期間制約を課す。
- 単発イベント実施: $y_{e,t} \in {0,1}$（日 $t$ にイベント $e$ を実施）
- 持続イベント開始: $s_{e,t} \in {0,1}$（日 $t$ にイベント $e$ を開始）
- 繰り返しイベント実施: $r_{e,t} \in {0,1}$（日 $t$ にイベント $e$ の周期実施）
- 作業者割当時間: $h_{w,e,t} \ge 0$（作業者 $w$ が日 $t$ にイベント $e$ へ従事する時間 $h$）
- 共有リソース使用時間: $u_{r,e,t} \ge 0$（リソース $r$ が日 $t$ にイベント $e$ へ供給する時間 $h$）
- 収穫作業量（面積ベースの指標）: $harv_{c,t} \ge 0$（日 $t$ に作物 $c$ の収穫対象面積）
- ピーク超過量: $over_t \ge 0$（日 $t$ の収穫需要の能力超過分）
- 分散度計測の補助（同一作物の圃場分散）:
  - 二値: $z_{lc} \in {0,1}$（圃場 $l$ で作物 $c$ を採用）
  - 集約度/分散度指標用の補助連続変数（後述の目的式で使用）

CP-SAT 実装ノート:
- $x_{l,c,t}$ を連続にすると CP-SAT ではドメインに実数は直接使えないため、面積を離散単位（例えば 0.1a 刻み）にしたバイナリ多重化、または混合整数線形（MIP）ソルバ（OR-Tools の GLOP/SCIP）を併用する。

## 4. 制約（Constraints）

### 4.1 土地面積制約
- 各日・各圃場の総使用面積は上限以下:
  $$\sum_{c \in C} x_{l,c,t} \le area_l \quad (\forall l,t)$$
- 事前割付の順守（あるいは下限として扱う）:
  $$\sum_{t \in T} x_{l,c,t} \ge fixed\_area_{lc} \quad (\forall l,c)$$
- 土地利用禁止日のゼロ制約:
  $$x_{l,c,t} = 0 \quad \text{if } land\_blocked_{l,t}=1$$

### 4.2 作物面積の上下限（期間合計または最終時点）
- 合計作付け面積の上下限（期間合計ベースの例）:
  $$area\_min_c \le \sum_{l,t} x_{l,c,t} \le area\_max_c \quad (\forall c)$$

### 4.3 イベント実施の可行性ウィンドウ
- 単発:
  $$y_{e,t} = 0 \quad (t \notin window_e)$$
- 繰り返し: 開始・終了条件期間でのみ実施可、かつ周期性を誘導。
  - 例: $r_{e,t} = 0$ if $t$ outside $[min(start\_cond_e), max(end\_cond_e)]$。
  - 周期性はソフト制約化か、$r_{e,t} = r_{e,t-freq_e}$ 等の差分/パターン制約で近似。
- 持続: 開始可能期間のみ $s_{e,t}$ 許可、開始後 $dur_e$ 日間は稼働。
  - 稼働中インジケータ: $active_{e,t} \in {0,1}$ を導入し、
    $$active_{e,t} = \sum_{\tau=t-dur_e+1}^{t} s_{e,\tau} \quad (\forall e \in E_{sus}, t)$$
    境界外は 0 とみなす。

### 4.4 労働需要と作業者容量
- イベント日次労働需要の充足（面積連動）:
  - イベント $e$ が作物$c=crop_e$に紐づくとして、日$t$の当該作業面積を $A_{e,t} = \sum_{l} x_{l,c,t}$ と置く。
  - 必要総工数: $need_{e,t} = labor\_per\_area_e * A_{e,t}$。
  - 単発/繰返/持続の稼働インジケータ $act_{e,t}$（$y_{e,t}$ または $r_{e,t}$ または $active_{e,t}$）により、
    $$\sum_{w} h_{w,e,t} \ge need_{e,t} \cdot act_{e,t}$$
- 所要人数の下限（1人あたり閾値 $Hmin$ を導入する場合）:
  $$\sum_{w} [h_{w,e,t} \ge \epsilon] \ge people\_req_e \cdot act_{e,t}$$
  CP-SAT では、バイナリ $assign_{w,e,t}$ と $h_{w,e,t} \le M \cdot assign_{w,e,t}$、$\sum_w assign_{w,e,t} \ge people\_req_e \cdot act_{e,t}$ で実装。
- 作業者の一日容量:
  $$\sum_{e} h_{w,e,t} \le worker\_cap_w \quad (\forall w,t)$$
- 作業不可日のゼロ制約:
  $$h_{w,e,t} = 0 \quad \text{if } worker\_blocked_{w,t}=1$$
- 必須役割満たす割当（各 $e$ の $roles\_req_e$）:
  役割 $q$ ごとに、$assign_{w,e,t}$ と作業者の役割属性 $role\_has_{w,q}$ を使い、
  $$\sum_{w} role\_has_{w,q} \cdot assign_{w,e,t} \ge 1 \quad (\forall q \in roles\_req\_e, t)$$

### 4.5 共有リソース容量
- リソース使用時間充足と容量上限（容量 $cap_r$ を仮定）:
  $$\sum_{e} u_{r,e,t} \le cap_r \quad (\forall r,t)$$
- リソース必要イベントへの供給:
  $resources\_req_e$ に含まれる場合、$u_{r,e,t}$ が $need_{e,t}$ を支援するよう、
  $$\sum_{r \in resources\_req_e} u_{r,e,t} \ge \alpha \cdot need_{e,t} \cdot act_{e,t}$$
  係数 $\alpha$ は時間換算比率。禁止日は $u_{r,e,t}=0$。

### 4.6 作物と圃場の分散・集約リンク
- 二値 $z_{l,c}$ と面積のリンク:
  $$x_{l,c,t} \le area_l \cdot z_{l,c} \quad (\forall l,c,t)$$
  $$z_{l,c} \in \{0,1\}$$

### 4.7 収穫能力とピーク超過
- 収穫作業量は対応面積以内:
  $$harv_{c,t} \le \sum_{l} x_{l,c,t}$$
- 収穫能力（全作物合計）が上限を超えないように、超過分 $over_t$ を導入:
  $$\sum_{c} harv_{c,t} \le harvest\_cap_t + over_t \quad (\forall t)$$

### 4.8 土地の遊休（アイドル）日
- 土地$l$のアイドル日指標 $idle_{l,t} \ge 0$ を導入:
  $$\sum_{c} x_{l,c,t} + idle_{l,t} = area_l \quad (\forall l,t \text{ with } land\_blocked_{l,t}=0)$$

## 5. 目的関数（Objectives）
多目的は加重和で単一目的に縮約する。

- 収益最大化（収穫面積 × 作物単価）:
  $$Profit = \sum_{c,t} price_c \cdot harv_{c,t}$$
- 労働時間最小化:
  $$Labor = \sum_{w,e,t} h_{w,e,t}$$
- 土地遊休の最小化:
  $$Idle = \sum_{l,t} idle_{l,t}$$
- 分散度（同一作物の圃場散在）最小化（集約志向）:
  - 例1: 圃場採用数ペナルティ $$Disp = \sum_{c} \sum_{l} z_{l,c}$$
  - 例2: HHI/エントロピーを近似（線形化のため区分近似や補助変数が必要）
- 収穫ピーク超過の最小化:
  $$PeakOver = \sum_{t} over_t$$
- 多品目志向（多様性）または単一作物志向：
  - 多品目志向: 作付品目数を増やす（$\sum_c [\sum_{l,t} x_{l,c,t} > 0]$ を最大化、CP-SAT では二値 $use_c$ で線形化）。
  - 単一作物志向: 上記の逆（品目数ペナルティ）。

統合目的（最大化形に変換する場合は符号調整）:
$$\max \; w_{profit}\,Profit - w_{labor}\,Labor - w_{idle}\,Idle - w_{dispersion}\,Disp - w_{peak}\,PeakOver + w_{diversity}\,Diversity$$

## 6. OR-Tools 実装メモ
- 推奨ソルバ: CP-SAT（`cp_model.CpModel`）。面積など連続量は刻み幅を設けて整数化（例: 0.1a を 1 ユニット）し、`IntVar`/`BoolVar` で表現。連続が必要なら MIP（SCIP）で `NumVar` を使用。
- インジケータ制約: `model.Add(var <= K).OnlyEnforceIf(boolVar)` を多用し、大$M$を避ける。
- 周期・持続の表現: スライディングウィンドウで $active_{e,t}$ を表し、`Add(sum(s_e,tau) == active)` 等で連結。
- 役割要件: $assign_{w,e,t}$ 二値と $h_{w,e,t} \le M*assign$、$sum(assign) \ge people\_req_e$ を併用。
- 目的の正規化: 各項目をスケールして桁を揃える（例: 収益を千円単位、時間は時間単位等）。

## 7. データ仕様の対応（I/O）
- 単位は内部で統一（例: 面積[a]→ユニット、時間[h]、金額[千円]）。
- 期間 $T$ は日付を整数日に写像。禁止期間は該当 $t$ を 1 とする行列で入力。
- 事前割付 $fixed\_area_{l,c}$ は厳密制約か、ソフト化してペナルティ項に移す選択可。

## 8. 拡張・簡略化オプション
- 簡略化: $x_{l,c,t}$ を $x_{l,c}$ にし、イベントは可動フラグのみ扱う（解の時間解像度を下げる）。
- 拡張: 生育ステージやリードタイム、ローテーション制約、病害回避の輪作制約等を $t$ 方向の論理で追加。

## 9. 実装スケッチ（擬似コード）
```python
from ortools.sat.python import cp_model

model = cp_model.CpModel()

# 例: 変数（刻み幅 unit を導入）
unit = 1  # 面積の最小刻み（例: 0.1a -> unit=1 は別スケールで）
x = {}  # (l,c,t) -> IntVar
for l in L:
    for c in C:
        for t in T:
            x[l,c,t] = model.NewIntVar(0, int(area_l[l]), f"x_{l}_{c}_{t}")

# 例: 土地面積制約
for l in L:
    for t in T:
        model.Add(sum(x[l,c,t] for c in C) <= int(area_l[l]))

# ... 残りの制約・目的関数を上記定義に沿って追加 ...
```
