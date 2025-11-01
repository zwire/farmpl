export type WizardStepId =
  | "horizon"
  | "lands"
  | "workers"
  | "resources"
  | "crops"
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
    title: "期間",
    description: "日数と全体設定を入力します",
  },
  {
    id: "lands",
    title: "圃場",
    description: "圃場の面積や利用制約を設定します",
  },
  {
    id: "workers",
    title: "労働力",
    description: "作業者の役割や稼働制約を設定します",
  },
  {
    id: "resources",
    title: "共有リソース",
    description: "機械・資材と稼働制約を設定します",
  },
  {
    id: "crops",
    title: "作物",
    description: "栽培する作物と価格情報を設定します",
  },
  {
    id: "constraints",
    title: "制約",
    description: "面積上下限や固定割当・最適化パラメータを調整します",
  },
  {
    id: "events",
    title: "作業計画",
    description: "依存関係を可視化しながら作業計画を設計します",
  },
];

export const INITIAL_STEP_ID: WizardStepId = "horizon";
