import { planFormSchema } from "@/lib/validation/plan-schema";
import type { ZodIssue } from "zod";
import type {
  PlanFormCrop,
  PlanFormCropAreaBound,
  PlanFormEvent,
  PlanFormFixedArea,
  PlanFormLand,
  PlanFormResource,
  PlanFormStagesConfig,
  PlanFormState,
  PlanFormWorker,
} from "@/lib/types/planning";
import type {
  DateRange,
  IsoDateString,
  PlanConversionResult,
  PlanConversionWarning,
  PlanUiEvent,
  PlanUiHorizon,
  PlanUiLand,
  PlanUiResource,
  PlanUiState,
  PlanUiWorker,
  WarningType,
} from "./planning-ui-types";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatIsoDate = (date: Date): IsoDateString => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as IsoDateString;
};

const parseIsoDate = (value: string): Date | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

const addDays = (date: Date, offset: number): Date =>
  new Date(date.getTime() + offset * MS_PER_DAY);

const differenceInDays = (start: Date, end: Date): number =>
  Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);

const createWarning = (
  type: WarningType,
  path: (string | number)[],
  message: string,
): PlanConversionWarning => ({
  type,
  path,
  message,
});

const ensureValidHorizonDates = (
  startDate: IsoDateString,
  endDate: IsoDateString,
): { start: Date; end: Date } => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) {
    throw new RangeError("Horizon dates must be valid ISO strings");
  }
  if (differenceInDays(start, end) < 0) {
    throw new RangeError("Horizon endDate must be on or after startDate");
  }
  return { start, end };
};

const uniqueSorted = (values: Iterable<number>): number[] =>
  Array.from(new Set(values)).sort((a, b) => a - b);

const convertDateListToIndices = (
  dates: IsoDateString[] | undefined,
  horizonStart: Date,
  maxDayIndex: number,
  path: (string | number)[],
  warnings: PlanConversionWarning[],
): number[] | undefined => {
  if (!dates || dates.length === 0) return undefined;
  const indices: number[] = [];
  for (const value of dates) {
    const parsed = parseIsoDate(value);
    if (!parsed) {
      warnings.push(
        createWarning("INVALID_DATE", [...path], `無効な日付です: ${value}`),
      );
      continue;
    }
    let index = differenceInDays(horizonStart, parsed);
    if (index < 0 || index > maxDayIndex) {
      warnings.push(
        createWarning(
          "RANGE_CLIPPED",
          [...path],
          `日付 ${value} は計画範囲外のため調整されました`,
        ),
      );
      index = clamp(index, 0, maxDayIndex);
    }
    indices.push(index);
  }
  const result = uniqueSorted(indices);
  return result.length ? result : undefined;
};

const expandRangeToIndices = (
  range: DateRange,
  horizonStart: Date,
  maxDayIndex: number,
  horizonEnd: Date,
  path: (string | number)[],
  warnings: PlanConversionWarning[],
): number[] => {
  const startDate = range.start ? parseIsoDate(range.start) : horizonStart;
  const endDate = range.end ? parseIsoDate(range.end) : horizonEnd;
  if (!startDate || !endDate) {
    warnings.push(
      createWarning(
        "INVALID_DATE",
        [...path],
        `無効な日付範囲です: ${range.start} - ${range.end ?? "(open)"}`,
      ),
    );
    return [];
  }
  const rawStart = differenceInDays(horizonStart, startDate);
  const rawEnd = differenceInDays(horizonStart, endDate);
  if (rawEnd < rawStart) {
    warnings.push(
      createWarning(
        "RANGE_EMPTY",
        [...path],
        `終了日が開始日より前です: ${range.start} - ${range.end ?? "(open)"}`,
      ),
    );
    return [];
  }
  let startIndex = rawStart;
  let endIndex = rawEnd;
  let clipped = false;
  if (startIndex < 0 || endIndex > maxDayIndex) {
    clipped = true;
    startIndex = clamp(startIndex, 0, maxDayIndex);
    endIndex = clamp(endIndex, 0, maxDayIndex);
  }
  if (clipped) {
    warnings.push(
      createWarning(
        "RANGE_CLIPPED",
        [...path],
        `日付範囲が計画期間外のため切り詰められました: ${range.start} - ${
          range.end ?? "(open)"
        }`,
      ),
    );
  }
  const values: number[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    values.push(index);
  }
  return values;
};

const convertRangesToIndices = (
  ranges: DateRange[],
  horizonStart: Date,
  horizonEnd: Date,
  maxDayIndex: number,
  path: (string | number)[],
  warnings: PlanConversionWarning[],
): number[] => {
  const indices: number[] = [];
  ranges.forEach((range, rangeIndex) => {
    const pathWithRange = [...path, rangeIndex];
    indices.push(
      ...expandRangeToIndices(
        range,
        horizonStart,
        maxDayIndex,
        horizonEnd,
        pathWithRange,
        warnings,
      ),
    );
  });
  return uniqueSorted(indices);
};

const indicesToDateRanges = (
  indices: number[] | undefined,
  horizonStart: Date,
): DateRange[] => {
  if (!indices || indices.length === 0) return [];
  const sorted = uniqueSorted(indices).filter((value) => value >= 0);
  if (sorted.length === 0) return [];
  const ranges: DateRange[] = [];
  let rangeStart = sorted[0];
  let previous = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push({
      start: formatIsoDate(addDays(horizonStart, rangeStart)),
      end: formatIsoDate(addDays(horizonStart, previous)),
    });
    rangeStart = current;
    previous = current;
  }

  ranges.push({
    start: formatIsoDate(addDays(horizonStart, rangeStart)),
    end: formatIsoDate(addDays(horizonStart, previous)),
  });

  return ranges;
};

const toPlanFormLands = (
  lands: PlanUiLand[],
  horizonDates: { start: Date; end: Date },
  maxDayIndex: number,
  warnings: PlanConversionWarning[],
): PlanFormLand[] =>
  lands.map((land, landIndex) => {
    const blockedDays = convertRangesToIndices(
      land.blocked,
      horizonDates.start,
      horizonDates.end,
      maxDayIndex,
      ["lands", landIndex, "blocked"],
      warnings,
    );
    return {
      id: land.id,
      name: land.name,
      area: land.area,
      tags: land.tags,
      blockedDays: blockedDays.length ? blockedDays : undefined,
    };
  });

const toPlanFormWorkers = (
  workers: PlanUiWorker[],
  horizonDates: { start: Date; end: Date },
  maxDayIndex: number,
  warnings: PlanConversionWarning[],
): PlanFormWorker[] =>
  workers.map((worker, workerIndex) => {
    const blockedDays = convertRangesToIndices(
      worker.blocked,
      horizonDates.start,
      horizonDates.end,
      maxDayIndex,
      ["workers", workerIndex, "blocked"],
      warnings,
    );
    return {
      id: worker.id,
      name: worker.name,
      roles: worker.roles,
      capacityPerDay: worker.capacityPerDay,
      blockedDays: blockedDays.length ? blockedDays : undefined,
    };
  });

const toPlanFormResources = (
  resources: PlanUiResource[],
  horizonDates: { start: Date; end: Date },
  maxDayIndex: number,
  warnings: PlanConversionWarning[],
): PlanFormResource[] =>
  resources.map((resource, resourceIndex) => {
    const blockedDays = convertRangesToIndices(
      resource.blocked,
      horizonDates.start,
      horizonDates.end,
      maxDayIndex,
      ["resources", resourceIndex, "blocked"],
      warnings,
    );
    return {
      id: resource.id,
      name: resource.name,
      category: resource.category,
      capacityPerDay: resource.capacityPerDay,
      blockedDays: blockedDays.length ? blockedDays : undefined,
    };
  });

const toPlanFormEvents = (
  events: PlanUiEvent[],
  horizonDates: { start: Date; end: Date },
  maxDayIndex: number,
  warnings: PlanConversionWarning[],
): PlanFormEvent[] =>
  events.map((event, eventIndex) => {
    const startCond = convertDateListToIndices(
      event.startDates,
      horizonDates.start,
      maxDayIndex,
      ["events", eventIndex, "startDates"],
      warnings,
    );
    const endCond = convertDateListToIndices(
      event.endDates,
      horizonDates.start,
      maxDayIndex,
      ["events", eventIndex, "endDates"],
      warnings,
    );
    return {
      id: event.id,
      cropId: event.cropId,
      name: event.name,
      category: event.category,
      startCond,
      endCond,
      frequencyDays: event.frequencyDays,
      precedingEventId: event.precedingEventId,
      lag: event.lag,
      labor: event.labor,
      requiredRoles: event.requiredRoles,
      requiredResources: event.requiredResources,
      usesLand: event.usesLand,
    };
  });

const constructPlanForm = (
  uiPlan: PlanUiState,
  horizonDates: { start: Date; end: Date },
  totalDays: number,
  warnings: PlanConversionWarning[],
): PlanFormState => {
  const maxDayIndex = Math.max(totalDays - 1, 0);
  const lands = toPlanFormLands(
    uiPlan.lands,
    horizonDates,
    maxDayIndex,
    warnings,
  );
  const workers = toPlanFormWorkers(
    uiPlan.workers,
    horizonDates,
    maxDayIndex,
    warnings,
  );
  const resources = toPlanFormResources(
    uiPlan.resources,
    horizonDates,
    maxDayIndex,
    warnings,
  );
  const events = toPlanFormEvents(
    uiPlan.events,
    horizonDates,
    maxDayIndex,
    warnings,
  );

  const plan: PlanFormState = {
    horizon: { numDays: totalDays },
    crops: uiPlan.crops.map<PlanFormCrop>((crop) => ({ ...crop })),
    lands,
    workers,
    resources,
    events,
    cropAreaBounds: uiPlan.cropAreaBounds.map<PlanFormCropAreaBound>(
      (bound) => ({
        ...bound,
      }),
    ),
    fixedAreas: uiPlan.fixedAreas.map<PlanFormFixedArea>((fixed) => ({
      ...fixed,
    })),
    stages: uiPlan.stages
      ? ({ ...uiPlan.stages } satisfies PlanFormStagesConfig)
      : undefined,
  };

  return plan;
};

export const PlanningCalendarService = {
  recalculateHorizon(
    startDate: IsoDateString,
    endDate: IsoDateString,
  ): PlanUiHorizon {
    const { start, end } = ensureValidHorizonDates(startDate, endDate);
    const totalDays = differenceInDays(start, end) + 1;
    return {
      startDate,
      endDate,
      totalDays,
    };
  },

  dateToDayIndex(startDate: IsoDateString, targetDate: IsoDateString): number {
    const start = parseIsoDate(startDate);
    const target = parseIsoDate(targetDate);
    if (!start || !target) {
      throw new RangeError("Invalid ISO date supplied");
    }
    return differenceInDays(start, target);
  },

  dayIndexToDate(startDate: IsoDateString, index: number): IsoDateString {
    const start = parseIsoDate(startDate);
    if (!start) {
      throw new RangeError("Invalid ISO date supplied");
    }
    const target = addDays(start, index);
    return formatIsoDate(target);
  },

  rangesToDayIndices(
    ranges: DateRange[],
    horizon: PlanUiHorizon,
  ): { days: number[]; warnings: PlanConversionWarning[] } {
    const warnings: PlanConversionWarning[] = [];
    const { start, end } = ensureValidHorizonDates(
      horizon.startDate,
      horizon.endDate,
    );
    const days = convertRangesToIndices(
      ranges,
      start,
      end,
      Math.max(horizon.totalDays - 1, 0),
      ["ranges"],
      warnings,
    );
    return { days, warnings };
  },

  convertToApiPlan(uiPlan: PlanUiState): PlanConversionResult {
    const warnings: PlanConversionWarning[] = [];
    const issues: ZodIssue[] = [];
    const { start, end } = ensureValidHorizonDates(
      uiPlan.horizon.startDate,
      uiPlan.horizon.endDate,
    );
    const totalDays = differenceInDays(start, end) + 1;
    const normalizedPlan = constructPlanForm(
      uiPlan,
      { start, end },
      totalDays,
      warnings,
    );

    const parsed = planFormSchema.safeParse(normalizedPlan);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        issues.push(issue);
        warnings.push(
          createWarning("VALIDATION_ERROR", issue.path, issue.message),
        );
      });
      return { plan: normalizedPlan, warnings, issues };
    }
    return { plan: parsed.data, warnings, issues };
  },

  mergeApiPlanIntoUiPlan(
    currentUiPlan: PlanUiState,
    apiPlan: PlanFormState,
  ): PlanUiState {
    const existingStart = parseIsoDate(currentUiPlan.horizon.startDate);
    const resolvedStart = existingStart ?? new Date(Date.now());
    const resolvedStartIso = formatIsoDate(resolvedStart);
    const endIso = formatIsoDate(
      addDays(resolvedStart, Math.max(apiPlan.horizon.numDays - 1, 0)),
    );
    const horizon = this.recalculateHorizon(resolvedStartIso, endIso);

    const convertBlocked = (indices?: number[] | null) =>
      indicesToDateRanges(indices ?? undefined, resolvedStart);

    const convertDates = (indices?: number[] | null) =>
      indices && indices.length > 0
        ? uniqueSorted(indices).map((index) =>
            formatIsoDate(
              addDays(
                resolvedStart,
                clamp(index, 0, Math.max(horizon.totalDays - 1, 0)),
              ),
            ),
          )
        : undefined;

    return {
      horizon,
      crops: apiPlan.crops.map((crop) => ({ ...crop })),
      lands: apiPlan.lands.map((land) => ({
        id: land.id,
        name: land.name,
        area: land.area,
        tags: land.tags ?? [],
        blocked: convertBlocked(land.blockedDays),
      })),
      workers: apiPlan.workers.map((worker) => ({
        id: worker.id,
        name: worker.name,
        roles: worker.roles,
        capacityPerDay: worker.capacityPerDay,
        blocked: convertBlocked(worker.blockedDays),
      })),
      resources: apiPlan.resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        category: resource.category ?? undefined,
        capacityPerDay: resource.capacityPerDay ?? undefined,
        blocked: convertBlocked(resource.blockedDays),
      })),
      events: apiPlan.events.map((event) => ({
        id: event.id,
        cropId: event.cropId,
        name: event.name,
        category: event.category ?? undefined,
        startDates: convertDates(event.startCond),
        endDates: convertDates(event.endCond),
        frequencyDays: event.frequencyDays ?? undefined,
        precedingEventId: event.precedingEventId ?? undefined,
        lag: event.lag ?? undefined,
        labor: event.labor ?? undefined,
        requiredRoles: event.requiredRoles ?? undefined,
        requiredResources: event.requiredResources ?? undefined,
        usesLand: event.usesLand,
      })),
      cropAreaBounds: apiPlan.cropAreaBounds.map((bound) => ({ ...bound })),
      fixedAreas: apiPlan.fixedAreas.map((fixed) => ({ ...fixed })),
      stages: apiPlan.stages ? { ...apiPlan.stages } : undefined,
    };
  },
};

export type PlanningCalendarServiceType = typeof PlanningCalendarService;
