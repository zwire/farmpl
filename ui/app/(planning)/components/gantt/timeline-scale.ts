const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type TimelineScaleType = "day" | "third";

export interface TimelineScaleOptions {
  type: TimelineScaleType;
  startDateIso: string;
  totalDays: number;
  minUnitWidth?: number;
}

export interface TimelineTick {
  day: number; // For 'day' scale, this is day index. For 'third' scale, this is third index.
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
  tickToDayRange: (
    tickIndex: number,
  ) => { startDay: number; endDay: number } | null;
}

export const createTimelineScale = ({
  type,
  startDateIso,
  totalDays,
  minUnitWidth,
}: TimelineScaleOptions): TimelineScale => {
  if (type === "third") {
    return createThirdScale({
      startDateIso,
      totalDays,
      minUnitWidth: minUnitWidth ?? 28,
    });
  }
  return createDayScale({
    startDateIso,
    totalDays,
    minUnitWidth: minUnitWidth ?? 18,
  });
};

// --- Third Scale Implementation ---

const getDateInfo = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-11
  const dayOfMonth = date.getUTCDate(); // 1-31
  return { year, month, dayOfMonth };
};

const getThirdOfMonth = (
  dayOfMonth: number,
): { index: 0 | 1 | 2; name: "上旬" | "中旬" | "下旬" } => {
  if (dayOfMonth <= 10) return { index: 0, name: "上旬" };
  if (dayOfMonth <= 20) return { index: 1, name: "中旬" };
  return { index: 2, name: "下旬" };
};

const getDaysInMonth = (year: number, month: number): number => {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
};

interface Third {
  thirdIndex: number;
  startDay: number;
  endDay: number;
  year: number;
  month: number;
  thirdName: string;
  isMajor: boolean;
  label: string;
}

const createThirdScale = ({
  startDateIso,
  totalDays,
  minUnitWidth,
}: {
  startDateIso: string;
  totalDays: number;
  minUnitWidth: number;
}): TimelineScale => {
  const unitWidth = minUnitWidth;
  const baseDate = parseIsoDate(startDateIso);

  const thirds: Third[] = [];
  let currentDay = 0;
  let thirdIndex = 0;

  while (currentDay < totalDays) {
    const date = addDays(baseDate, currentDay);
    const { year, month, dayOfMonth } = getDateInfo(date);
    const daysInMonth = getDaysInMonth(year, month);

    const thirdInfo = getThirdOfMonth(dayOfMonth);

    let thirdEndDayOfMonth = 0;
    if (thirdInfo.index === 0) {
      thirdEndDayOfMonth = 10;
    } else if (thirdInfo.index === 1) {
      thirdEndDayOfMonth = 20;
    } else {
      thirdEndDayOfMonth = daysInMonth;
    }

    const endOfThirdDate = new Date(Date.UTC(year, month, thirdEndDayOfMonth));
    const endOfThirdDayIndex =
      (endOfThirdDate.getTime() - baseDate.getTime()) / DAY_IN_MS;

    const startDay = currentDay;
    const endDay = Math.min(Math.round(endOfThirdDayIndex), totalDays - 1);

    thirds.push({
      thirdIndex,
      startDay,
      endDay,
      year,
      month,
      thirdName: thirdInfo.name,
      isMajor: thirdInfo.index === 0,
      label: `${month + 1}月 ${thirdInfo.name}`,
    });

    currentDay = endDay + 1;
    thirdIndex++;
  }

  const totalWidth = thirds.length * unitWidth;
  const ticks: TimelineTick[] = thirds.map((t) => ({
    day: t.thirdIndex, // Using 'day' as the index of the third
    x: t.thirdIndex * unitWidth,
    label: t.label,
    isMajor: t.isMajor,
  }));

  const dayToThirdIndex = new Array(totalDays);
  for (const third of thirds) {
    for (let i = third.startDay; i <= third.endDay; i++) {
      if (i < totalDays) {
        dayToThirdIndex[i] = third.thirdIndex;
      }
    }
  }

  const positionForDay = (day: number): number => {
    const index = dayToThirdIndex[day];
    if (index === undefined) return -1;
    return index * unitWidth;
  };

  const spanWidth = (startDay: number, endDay: number): number => {
    const startThirdIndex = dayToThirdIndex[startDay];
    const endThirdIndex = dayToThirdIndex[endDay];
    if (startThirdIndex === undefined || endThirdIndex === undefined) return 0;
    return (endThirdIndex - startThirdIndex + 1) * unitWidth;
  };

  const tooltipFormatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });

  const formatTooltip = (index: number): string => {
    const third = thirds[index];
    if (!third) return "";
    const startDate = addDays(baseDate, third.startDay);
    const endDate = addDays(baseDate, third.endDay);
    return `${tooltipFormatter.format(startDate)}〜${tooltipFormatter.format(endDate)}`;
  };

  return {
    type: "third",
    unitWidth,
    totalWidth,
    ticks,
    positionForDay,
    spanWidth,
    formatTooltip,
    tickToDayRange: (tickIndex: number) => {
      const third = thirds[tickIndex];
      if (!third) return null;
      return { startDay: third.startDay, endDay: third.endDay };
    },
  };
};

// --- Day Scale Implementation ---

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
  if (ticks.length > 0 && ticks[ticks.length - 1]?.day !== totalDays - 1) {
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
    tickToDayRange: (tickIndex: number) => {
      // For day scale, tick.day is the day index, which is the same as the tickIndex if interval is 1.
      // The ticks array may not be contiguous, so we should get it from there.
      const tick = ticks.find((t) => t.day === tickIndex);
      if (!tick) return null; // Should not happen in practice for day scale
      return { startDay: tick.day, endDay: tick.day };
    },
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
