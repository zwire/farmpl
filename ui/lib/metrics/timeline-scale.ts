const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type TimelineScaleType = "third";

export interface TimelineScaleOptions {
  startDateIso: string;
  totalDays: number;
  minUnitWidth?: number;
}

export interface TimelineTick {
  index: number;
  x: number;
  label: string;
  isMajor: boolean;
}

export interface TimelineScale {
  unitWidth: number;
  totalWidth: number;
  ticks: TimelineTick[];
  spanWidth: (startDay: number, endDay: number) => number;
  formatTooltip: (index: number) => string;
  tickToDayRange: (
    tickIndex: number,
  ) => { startDay: number; endDay: number } | null;
}

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

export const createThirdScale = ({
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
    index: t.thirdIndex,
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

  const spanWidth = (startDay: number, endDay: number): number => {
    const startThirdIndex = dayToThirdIndex[startDay];
    const endThirdIndex = dayToThirdIndex[endDay];
    if (startThirdIndex === undefined || endThirdIndex === undefined) return 0;
    return (endThirdIndex - startThirdIndex + 1) * unitWidth;
  };

  const formatTooltip = (index: number): string => {
    const third = thirds[index];
    if (!third) return "";
    const startDate = addDays(baseDate, third.startDay);
    const endDate = addDays(baseDate, third.endDay);
    const fmt = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    return `${fmt(startDate)}〜${fmt(endDate)}`;
  };

  return {
    unitWidth,
    totalWidth,
    ticks,
    spanWidth,
    formatTooltip,
    tickToDayRange: (tickIndex: number) => {
      const third = thirds[tickIndex];
      if (!third) return null;
      return { startDay: third.startDay, endDay: third.endDay };
    },
  };
};

const parseIsoDate = (iso: string): Date => {
  const datePart = iso.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
};

const addDays = (date: Date, offset: number): Date =>
  new Date(date.getTime() + offset * DAY_IN_MS);
