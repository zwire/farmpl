# テンプレート機能（API）

- 一覧: `GET /v1/templates`
- 具体化: `POST /v1/templates/instantiate`

## 使い方（開発者）
1. テンプレ TOML を `api/templates/crops/**` に追加
2. サーバーを起動（例: `./dev.api.sh`）
3. cURL で一覧確認
   ```bash
   curl -s localhost:8000/v1/templates | jq .
   ```
4. 具体化（開始日と期間を指定）
   ```bash
   curl -s -X POST localhost:8000/v1/templates/instantiate \
     -H 'Content-Type: application/json' \
     -d '{
       "template_id": "minitomato_rouchi",
       "start_date": "2025-04-10",
       "horizon_days": 160
     }' | jq .
   ```

## 動的調整
- 開始日の「月」に応じて、テンプレ内 `lag_days=[min,max]` を係数で倍率調整（四捨五入、最小1日）。
- 係数は `[seasonal] coeff_by_month`（なければ `default`）を使用。
- イベント単位で適用可否を制御: `seasonal_scale`（default: true）
  - 例: 農薬散布などは `seasonal_scale=false` を推奨。

## 生成される `ApiPlan`
- crops: テンプレ1作物（`price_per_a` を使用）。
- events: `start_window_days` と `lag_days` を `ApiEvent` の `start_cond/end_cond` と `lag_min/max_days` に変換。
- lands/workers/resources: 空配列（UI で後から追加想定）。

## 拡張のポイント
- `uses_land=true` の最初と最後のイベントで占有区間が張られます（最適化側ロジック）。
- 管理イベントの回数は拘束していません（`frequency_days` は近接抑止）。必要に応じてイベントを粒度細かく分割してください。
