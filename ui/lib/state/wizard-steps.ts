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
    title: "期間",
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
    title: "制約",
    description: "面積上下限や固定割当、最適化パラメータを調整します",
  },
  {
    id: "events",
    title: "作業計画",
    description: "依存関係を可視化しながら作業計画を設計します",
  },
];

export const INITIAL_STEP_ID: WizardStepId = "horizon";
