export type WizardStepId =
  | "horizon"
  | "crops"
  | "lands"
  | "workers"
  | "resources"
  | "constraints"
  | "events";

export interface WizardStep {
  id: WizardStepId;
  title: string;
  description: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "horizon",
    title: "計画期間",
    description: "日数と全体設定を入力します",
  },
  {
    id: "crops",
    title: "作物",
    description: "栽培する作物と価格情報を設定します",
  },
  {
    id: "lands",
    title: "圃場",
    description: "土地面積や利用不可日を設定します",
  },
  {
    id: "workers",
    title: "労働力",
    description: "作業者の役割と稼働制約を登録します",
  },
  {
    id: "resources",
    title: "共有リソース",
    description: "機械・資材と稼働制約を設定します",
  },
  {
    id: "constraints",
    title: "制約設定",
    description: "面積上下限や固定割当、ステージ設定を調整します",
  },
  {
    id: "events",
    title: "イベント",
    description: "依存関係を可視化しながらイベントを設計します",
  },
];

export const INITIAL_STEP_ID: WizardStepId = "horizon";
