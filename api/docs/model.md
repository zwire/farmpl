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

## 2. パラメータ（Parameters）
- 作物単価（円/a）: $price_c (c \in C)$
- 土地面積（a）: $area_l (l \in L)$
- イベント対象作物: $crop_e \in C (e \in E)$
- イベントカテゴリ（播種・定植・散水・収穫等）: $cat_e (e \in E)$（実装では列挙/ID）
- イベント所要人数（人）: $people\_req_e (e \in E)$
- イベント通算労働需要（h/a）: $labor\_total\_per\_area_e (e \in E)$
- イベント日次労働上限（h/日）: $labor\_daily\_cap_e (e \in E)$
- 必須役割リスト: $roles\_req_e \subseteq Q (e \in E)$（空集合可）
- 共有リソース必要リスト: $resources\_req_e \subseteq R (e \in E)$（空集合可）
 - 土地占有フラグ: $uses\_land_e \in \{0,1\}$（占有イベントなら 1）
- 作物面積上下限制約（任意）: $area\_min_c, area\_max_c (c \in C)$（未設定時は $0, +\infty$）
- 土地の事前割付（任意）: $fixed\_area_{lc} \ge 0 (l \in L, c \in C)$（未設定は $0$）
- 土地・作業者・共有リソースの利用禁止期間（任意）:
  - $land\_blocked_{l,t} \in {0,1}$
  - $worker\_blocked_{w,t} \in {0,1}$
  - $resource\_blocked_{r,t} \in {0,1}$
- 作業者上限作業時間（h/日）: $worker\_cap_w (w \in W)$
- イベント実施可能期間/条件:
  - 繰り返し: $start\_cond_e \subseteq T, end\_cond_e \subseteq T, freq_e \in Z_{\gt0}$
  
備考: 目的は段階（レキシコ）最適化で組み合わせます。

補助パラメータ：
- 面積→通算労働時間換算: $total\_labor\_e(a) = labor\_total\_per\_area\_e * a$
- 大M定数: $M$（十分大きい値、CP-SAT ではインジケータ制約で代替推奨）

## 3. 決定変数（Decision Variables）
- 面積配分（日次）: $x_{l,c,t} \ge 0$
- 面積の基底（包絡、占有期間で等値となる完成値）: $b_{l,c} \ge 0$
- 繰り返しイベント実施: $r_{e,t} \in {0,1}$
 - 作付け占有状態（補助）: $occ_{c,t} \in {0,1}$（占有中=1）
- 作業者割当時間: $h_{w,e,t} \ge 0$
- 共有リソース使用時間: $u_{r,e,t} \ge 0$
- ピーク超過量: $over_t \ge 0$
- 土地のアイドル（日次）: $idle_{l,t} \ge 0$
- 分散度（同一作物の圃場分散）補助:
  - 二値: $z_{l,c} \in {0,1}$
  - 補助連続変数（必要に応じて）

CP-SAT 実装ノート:
- $x_{l,c,t}$ を連続にすると CP-SAT ではドメインに実数は直接使えないため、面積を離散単位（例えば 0.1a 刻み）にしたバイナリ多重化、または混合整数線形（MIP）ソルバ（OR-Tools の GLOP/SCIP）を併用する。

### スパース化された定義域（パフォーマンス向上のための工夫）
- イベント $e$ の実施可能日集合を $T_e \subseteq T$（start/end などから導出）とする。$r_{e,t}, h_{w,e,t}, assign_{w,e,t}, u_{r,e,t}$ は $t\in T_e$ に対してのみ定義（それ以外は暗黙に 0）。
- 作物 $c$ の占有可能日集合を $T_c \subseteq T$（$uses\_land$ なイベントの可能日を外接する期間）とし、$x_{l,c,t}, occ_{l,c,t}$ は $t\in T_c$ のみ定義（$uses\_land$ が無い作物は全日）。
- 数理的には、$t\notin T_e, T_c$ の変数を 0 に固定したのと同値で可行領域は不変。実装上の生成量を削減して性能を上げるための工夫である。

## 4. 制約（Constraints）

### 4.1 土地面積制約
- 各日・各圃場の総使用面積は上限以下:
  $$\sum_{c \in C} x_{l,c,t} \le area_l \quad (\forall l,t)$$
- 事前割付（完了要件: occupancy 連動）:
  - 基底変数: $b_{l,c} \ge 0$ を導入（その圃場・作物での作付け面積の完成値）。
  - 完了下限:  $$b_{l,c} \ge fixed\_area_{l,c} \quad (\forall l,c)$$
  - 占有区間との連動（非ブロック日のみ等式）:
    $$x_{l,c,t} = b_{l,c} \quad \text{if } occ_{c,t}=1 \land land\_blocked_{l,t}=0$$
    $$x_{l,c,t} \in [0,\,b_{l,c}] \quad \text{otherwise}$$
  - 実施保証（少なくとも一度は占有する）:
    $$\sum_{t\in T} occ_{c,t} \ge 1 \quad \text{if } b_{l,c} > 0$$
  - 備考: これにより、blocked 日を避けつつ占有期間内で定値となり、全期間を占有し続ける必要はない。
- 土地利用禁止日のゼロ制約:
  $$x_{l,c,t} = 0 \quad \text{if } land\_blocked_{l,t}=1$$

### 4.2 作物面積の上下限（日次）
- 各日・全圃場合計に対する上下限（占有・ブロック考慮）:
  - 上限（常に適用）:
    $$\sum_{l} x_{l,c,t} \le area\_max_c \quad (\forall c, t \text{ with } area\_max_c\ \text{定義})$$
  - 下限（占有かつ利用可能圃場がある日に適用）:
    $$\sum_{l} x_{l,c,t} \ge area\_min_c \quad (\forall c, t \text{ s.t. } occ_{c,t}=1 \land \exists l:\ land\_blocked_{l,t}=0)$$
  備考: 全圃場が blocked の日は下限を課さない。

### 4.3 イベント実施の可行性ウィンドウ / 頻度 / ラグ
- 可用ウィンドウ: イベント $e$ は日 $t$ が $[\min(start\_cond_e),\;\max(end\_cond_e)]$ に入るときのみ実施可能。
  $$r_{e,t} = 0 \quad \text{if } t \notin [\min(start\_cond_e),\;\max(end\_cond_e)]$$

- 頻度（`frequency_days=f`）: 任意の連続 $f$ 日の窓でそのイベントは高々1回。
  $$\sum_{\tau=t}^{t+f-1} r_{e,\tau} \le 1 \quad (\forall t)$$
  例: $f=2$ で前日との連続実施を禁止、$f=5$ で5日窓に1回のみなど。期間全体で1回に制限したい場合は $f=|T|$ とする。

- ラグ（`preceding_event_id=p, lag_min=L_{\min}, lag_max=L_{\max}`）: 後続イベント $e$ は先行イベント $p$ の実施から $L_{\min}\,..\,L_{\max}$ 日後のいずれかでのみ許可する。
  - 最低日数が満たせないとき禁止:
    $$r_{e,t}=0 \quad \text{if } L_{\min}>0 \land t-L_{\min}<1$$
  - 許可ウィンドウ（十分前の先行）:
    $$r_{e,t} \le \sum_{\tau=\max(1,\,t-L_{\max})}^{t-L_{\min}} r_{p,\tau}$$
  - 直近基準の厳密化（“最後に行った先行イベント”から $L_{\min}$ 日は空ける）:
    $$r_{e,t} + r_{p,\tau} \le 1 \quad (\forall \tau \in [t-L_{\min}+1,\; t])$$
  上記により、先行が連続日で起きる場合でも「最後の先行」からのラグで判定され、早すぎる後続の発生を防ぐ。

### 4.4 作付け占有状態（occ）の導出と面積恒常性
- 占有状態の更新（例: 累積差分の近似）:
  $$occ_{c,t} \ge occ_{c,t-1} + \sum_{e:crop(e)=c,\;effect_e=start} r_{e,t} - \sum_{e:crop(e)=c,\;effect_e=end} r_{e,t}$$
  $$occ_{c,t} \in \{0,1\}$$
- 面積恒常性（占有中）:
  $$x_{l,c,t} = x_{l,c,t-1} \quad (\forall l,c,\; occ_{c,t}=1,\; t\notin blocked(l),\; t-1\notin blocked(l))$$

### 4.5 労働（需要・上限・人数・役割）
- イベント通算労働需要と日次上限制約（基底面積 b に連動）:
  - $B_c = \sum_{l} b_{l,c}$（作物 c の完成面積の合計）。

  - 面積刻みを $S$、イベント $e$ の通算係数を $L_e\,[h/a]$ とし、$p_e/q_e = L_e/S$（既約）。
  - 通算充足（$T_e$ はイベントの実施可能日）:
    $$q_e\,\sum_{t\in T_e}\sum_{w} h_{w,e,t} \;\ge\; p_e\, B_{crop(e)}$$
  - 日次上限: $\sum_{w} h_{w,e,t} \le labor\_daily\_cap\_e \cdot r_{e,t}\;(\forall t)$。
- 作業者の一日容量/不可日:  $$\sum_{e} h_{w,e,t} \le worker\_cap_w\quad(\forall w,t),\qquad h_{w,e,t}=0\;\text{if}\; worker\_blocked_{w,t}=1$$

- 割当リンク:  $$h_{w,e,t} \le worker\_cap_w \cdot r_{e,t},\quad h_{w,e,t} \le worker\_cap_w \cdot assign_{w,e,t}$$
- 人数要件（実施日にのみ適用）:  $$\sum_{w} assign_{w,e,t} \ge people\_{req,e} \quad \text{only if } r_{e,t}=1$$
- 役割要件/排他:  各必須ロールごとに $$\sum_{w:\; role\in roles(w)} assign_{w,e,t} \ge 1 \quad \text{only if } r_{e,t}=1$$、かつ 役割非保持・不可日は $$assign_{w,e,t}=0$$

### 4.6 共有リソース容量
- 容量上限（容量 $cap_r$ を仮定）:
  $$\sum_{e} u_{r,e,t} \le cap_r \quad (\forall r,t)$$
- 必要資源イベントの供給（必要集合が空でない場合）:
  $$\sum_{r \in resources\_req_e} u_{r,e,t} \ge \sum_{w} h_{w,e,t} \quad (\forall t)$$
  禁止日は $u_{r,e,t}=0$。

### 4.7 作物と圃場の分散・集約リンク
- 二値 $z_{l,c}$ と面積のリンク:
  $$x_{l,c,t} \le area_l \cdot z_{l,c} \quad (\forall l,c,t)$$
  $$b_{l,c} \le area_l \cdot z_{l,c} \quad (\forall l,c)$$
  $$z_{l,c} \in \{0,1\}$$

### 4.8 面積の時間連続性（作付け中の土地利用の一貫性担保）
- 占有区間の定義:
  - ある作物 $c$ について $uses\_land_e=1$ のイベント群を考える。
  - そのイベントが実行された最初の日と最後の日をそれぞれ $t^{\min}_c, t^{\max}_c$ とする。
  - CP-SAT では補助二値 $prefix_{c,t}$・$suffix_{c,t}$ を用いて、$occ_{c,t} = prefix_{c,t} \land suffix_{c,t}$ となるよう制約する。
  - これにより $occ_{c,t}=1$ となる日は $t^{\min}_c \le t \le t^{\max}_c$ に一致し、イベント間の空白期間でも占有が途切れない。
- 占有セグメント内（連続占有）かつ非ブロック日では面積一定:
  $$x_{l,c,t} = x_{l,c,t-1} \quad (\forall l,c,\; occ_{c,t-1}=1 \land occ_{c,t}=1,\; t\notin blocked(l),\; t-1\notin blocked(l))$$
  備考: 占有が 0→1 に切り替わる境界日（開始日）や 1→0 の終了日には等式を課さない。これにより、
  非占有日のゼロ値を開始日に引きずって FixedArea 等と矛盾する事態を避ける。
- 占有解除の即時反映:
  - 各作物・日について $occ_{c,t}=0$ なら全圃場で当該作物面積は 0 に制限する。
  - 線形化は $x_{l,c,t} \le area_l \cdot occ_{c,t}$（面積を整数化したスケールでは $cap_l$ を用いる）で実現でき、最終 uses_land イベントの翌日以降やブロック日を跨いだ後に自動的に作付けを撤収する。
- ブロック日による占有断絶:
  - 圃場ごとの占有指標 $occ_{l,c,t} \in \{0,1\}$ を導入し、$x_{l,c,t} > 0$ なら $occ_{l,c,t}=1$ となるよう $x_{l,c,t} \le cap_l \cdot occ_{l,c,t}$ で結合する。
  - ブロック日は土地自体が無効化されるので $occ_{l,c,t} = 0$ を強制し、`prefix`/`suffix` 型の伝播は「非ブロック日でのみ持続する」ように $occ_{l,c,t-1}$ を参照しつつブロック日で必ずリセットする。
  - これにより作付け開始・終了イベントはブロックの挟まらない区間にしか存在できず、土地が途切れるケースではブロック手前で占有が必ず一旦終了してから再開される。

補足（圃場＝作物の占有整合）:
- ある圃場・作物の採用二値 $z_{l,c}=1$ のとき、非ブロック日の全期間で「圃場レベル占有」と「作物レベル占有」を一致させる。
  $$ z_{l,c}=1 \land t\notin Block_l \Rightarrow occ_{l,c,t} = occ_{c,t} $$
- これにより、同一作物・同一圃場で占有が中抜けすること（面積が 0 になって再び戻るなど）が防止され、イベントの前後で突然別の圃場に切り替わる挙動も抑制される。

### 4.9 土地の遊休（アイドル）日
- 日次アイドル $idle_{l,t} \ge 0$:
  $$\sum_{c} x_{l,c,t} + idle_{l,t} = area_l \quad (\forall l,t \text{ with } land\_blocked_{l,t}=0)$$

## 5. 目的関数（Objectives）
多目的はレキシコグラフィック（段階）最適化で扱う（例: profit を最大化→その水準をロック→dispersion を最小化）。

- 収益最大化（作付け面積 × 作物単価）:
  $$Profit = \sum_{c} \sum_{l} price_c \cdot b_{l,c}$$
  備考: 占有中は $x_{l,c,t}=b_{l,c}$ となるため、基底変数で正確に表現できる。
- 労働時間最小化:
  $$Labor = \sum_{w,e,t} h_{w,e,t}$$
- 土地遊休の最小化:
  $$Idle = \sum_{l,t} idle_{l,t}$$
- 分散度（同一作物の圃場散在）最小化（集約志向）:
  - 例1: 圃場採用数ペナルティ $$Disp = \sum_{c} \sum_{l} z_{l,c}$$
  - 例2: HHI/エントロピーを近似（線形化のため区分近似や補助変数が必要）
- 多品目志向（多様性）または単一作物志向：
  - 多品目志向: 作付品目数を増やす（$\sum_c [\sum_{l,t} x_{l,c,t} > 0]$ を最大化、CP-SAT では二値 $use_c$ で線形化）。
  - 単一作物志向: 上記の逆（品目数ペナルティ）。

統合の方法: 現実装では「加重和」は用いず、profit→dispersion（+任意の追加ステージ）という段階最適化で達成します。

## 6. OR-Tools 実装メモ
- 推奨ソルバ: CP-SAT（`cp_model.CpModel`）。面積など連続量は刻み幅を設けて整数化（例: 0.1a を 1 ユニット）し、`IntVar`/`BoolVar` で表現。連続が必要なら MIP（SCIP）で `NumVar` を使用。
- インジケータ制約: `model.Add(var <= K).OnlyEnforceIf(boolVar)` を多用し、大$M$を避ける。
- 周期・持続の表現: スライディングウィンドウで $active_{e,t}$ を表し、`Add(sum(s_e,tau) == active)` 等で連結。
- 役割要件（排他）: 必須ロールを持たない・またはブロック日の作業者は当該イベント日に割当不可（$assign=0$）。各必須ロールごとに $\sum assign \ge 1$、さらに $\sum assign \ge people\_req_e$。
- 労働時間のスケール化: 1単位=0.1h（TIME_SCALE）で $h$ を整数化。
- 労働需要は小数でも厳密化（$\mathrm{frac}=(L\cdot S_t)/S_a$ を既約分数 $p/q$ として、
  $q\,\sum_{t\in T_e,w} h^{\text{scaled}}_{w,e,t} = p\,\sum_l x^{\text{units}}_{l,crop(e)}$ を等式で課す）。
- 目的の正規化: 各項目をスケールして桁を揃える（例: 収益を千円単位、時間は時間単位等）。
- スパース生成とヒント: 変数は $T_e, T_c$ のみに生成し、段階最適化の後段へ `model.AddHint(...)` で初期解のヒントを渡す（環境により未対応なら無視）。探索並列度は `CP_NUM_WORKERS`、時間制限は `SYNC_TIMEOUT_MS` で制御。

## 7. データ仕様の対応（I/O）
- 単位は内部で統一（例: 面積[a]→ユニット、時間[h]、金額[千円]）。
- 期間 $T$ は日付を整数日に写像。禁止期間は該当 $t$ を 1 とする行列で入力。
- 事前割付 $fixed\_area_{l,c}$ は $\sum_t x_{l,c,t} \ge fixed\_area_{l,c}$ として扱う。
- 出力は日別割り当て（land→day→crop→area）。

## 8. 拡張オプション
- 生育ステージやリードタイム、ローテーション制約、病害回避の輪作制約等を $t$ 方向の論理で追加。

## 9. 実装スケッチ（擬似コード）
```python
from ortools.sat.python import cp_model

model = cp_model.CpModel()

# 例: 面積変数（時間依存の x[l,c,t]）
x = {}  # (l,c,t) -> IntVar
for l in L:
    for c in C:
        for t in T:
            x[l,c,t] = model.NewIntVar(0, int(area_l[l]), f"x_{l}_{c}_{t}")

# 例: 土地面積制約（日次）
for l in L:
    for t in T:
        model.Add(sum(x[l,c,t] for c in C) <= int(area_l[l]))

# 日次変数 r[e,t], h[w,e,t], u[r,e,t], idle[l,t] は個別の制約モジュール内で生成・連結される。

# ... 残りの制約・目的関数を上記定義に沿って追加 ...
```
