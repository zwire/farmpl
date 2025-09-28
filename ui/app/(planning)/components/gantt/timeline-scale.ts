const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type TimelineScaleType = "day";

export interface TimelineScaleOptions {
  type: TimelineScaleType;
  startDateIso: string;
  totalDays: number;
  minUnitWidth?: number;
}

export interface TimelineTick {
  day: number;
  x: number;
  label: string;
  isMajor: boolean;
}

export interface TimelineScale {
  type: TimelineScaleType;
  unitWidth: number;
  totalWidth: number;
  ticks: TimelineTick[];
  positionForDay: (day: number) => number;
  spanWidth: (startDay: number, endDay: number) => number;
  formatTooltip: (day: number) => string;
}

export const createTimelineScale = ({
  startDateIso,
  totalDays,
  minUnitWidth = 18,
}: TimelineScaleOptions): TimelineScale => {
  return createDayScale({ startDateIso, totalDays, minUnitWidth });
};

const createDayScale = ({
  startDateIso,
  totalDays,
  minUnitWidth,
}: {
  startDateIso: string;
  totalDays: number;
  minUnitWidth: number;
}): TimelineScale => {
  const unitWidth = Math.max(minUnitWidth, determineUnitWidth(totalDays));
  const contentWidth = totalDays * unitWidth;
  const baseDate = parseIsoDate(startDateIso);
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
  const tooltipFormatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });

  const tickInterval = determineTickInterval(totalDays);
  const ticks: TimelineTick[] = [];
  for (let day = 0; day < totalDays; day += tickInterval) {
    const date = addDays(baseDate, day);
    ticks.push({
      day,
      x: day * unitWidth,
      label: formatter.format(date),
      isMajor: date.getUTCDate() === 1 || tickInterval === 1,
    });
  }
  if (ticks[ticks.length - 1]?.day !== totalDays - 1) {
    const lastDate = addDays(baseDate, totalDays - 1);
    ticks.push({
      day: totalDays - 1,
      x: (totalDays - 1) * unitWidth,
      label: formatter.format(lastDate),
      isMajor: true,
    });
  }

  return {
    type: "day",
    unitWidth,
    totalWidth: contentWidth,
    ticks,
    positionForDay: (day) => day * unitWidth,
    spanWidth: (startDay, endDay) =>
      Math.max(endDay - startDay + 1, 0) * unitWidth,
    formatTooltip: (day) => tooltipFormatter.format(addDays(baseDate, day)),
  };
};

const determineUnitWidth = (totalDays: number): number => {
  if (totalDays <= 30) return 28;
  if (totalDays <= 90) return 22;
  if (totalDays <= 180) return 18;
  return 14;
};

const determineTickInterval = (totalDays: number): number => {
  if (totalDays <= 35) return 1;
  if (totalDays <= 90) return 7;
  if (totalDays <= 180) return 14;
  return 30;
};

const parseIsoDate = (iso: string): Date => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
};

const addDays = (date: Date, offset: number): Date =>
  new Date(date.getTime() + offset * DAY_IN_MS);
