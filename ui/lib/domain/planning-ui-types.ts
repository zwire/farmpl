import type { ZodIssue } from "zod";
import type {
  AreaMeasurement,
  PlanFormCrop,
  PlanFormCropAreaBound,
  PlanFormFixedArea,
  PlanFormResource,
  PlanFormStagesConfig,
  PlanFormState,
  PlanFormWorker,
  PriceMeasurement,
} from "@/lib/types/planning";

export type IsoDateString = `${number}-${number}-${number}`;

export interface DateRange {
  /** inclusive start date in YYYY-MM-DD. null means horizon start */
  start: IsoDateString | null;
  /** inclusive end date. null indicates horizon end */
  end: IsoDateString | null;
}

export interface PlanUiHorizon {
  startDate: IsoDateString;
  endDate: IsoDateString;
  totalDays: number;
}

export type PlanUiCrop = PlanFormCrop;
export type PlanUiStagesConfig = PlanFormStagesConfig;
export type PlanUiCropAreaBound = PlanFormCropAreaBound;
export type PlanUiFixedArea = PlanFormFixedArea;

export type PlanUiLand = Omit<PlanFormState["lands"][number], "blockedDays"> & {
  blocked: DateRange[];
};

export type PlanUiWorker = Omit<PlanFormWorker, "blockedDays"> & {
  blocked: DateRange[];
};

export type PlanUiResource = Omit<PlanFormResource, "blockedDays"> & {
  blocked: DateRange[];
};

export interface PlanUiEvent
  extends Omit<PlanFormState["events"][number], "startCond" | "endCond"> {
  startDates?: IsoDateString[];
  endDates?: IsoDateString[];
}

export interface PlanUiState {
  horizon: PlanUiHorizon;
  crops: PlanUiCrop[];
  lands: PlanUiLand[];
  workers: PlanUiWorker[];
  resources: PlanUiResource[];
  events: PlanUiEvent[];
  cropAreaBounds: PlanUiCropAreaBound[];
  fixedAreas: PlanUiFixedArea[];
  stages?: PlanUiStagesConfig;
}

export type PlanUiAreaMeasurement = AreaMeasurement;
export type PlanUiPriceMeasurement = PriceMeasurement;

export type EventCategory =
  | "圃場準備"
  | "播種"
  | "定植"
  | "潅水"
  | "施肥"
  | "除草"
  | "防除"
  | "間引き"
  | "整枝"
  | "摘心"
  | "片付け"
  | "収穫"
  | "出荷"
  | "その他";

export const EVENT_CATEGORY_OPTIONS: readonly EventCategory[] = [
  "圃場準備",
  "播種",
  "定植",
  "潅水",
  "施肥",
  "除草",
  "防除",
  "間引き",
  "整枝",
  "摘心",
  "収穫",
  "出荷",
  "片付け",
  "その他",
];

export type WarningType =
  | "INVALID_DATE"
  | "RANGE_CLIPPED"
  | "RANGE_EMPTY"
  | "VALIDATION_ERROR";

export interface PlanConversionWarning {
  type: WarningType;
  path: (string | number)[];
  message: string;
}

export interface PlanConversionResult {
  plan: PlanFormState;
  warnings: PlanConversionWarning[];
  issues: ZodIssue[];
}
