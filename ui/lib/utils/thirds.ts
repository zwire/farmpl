import { createThirdScale } from "@/lib/metrics/timeline-scale";

export type DayRange = { startDay: number; endDay: number };

export function computeThirdRanges(
  startDateIso: string,
  totalDays: number,
): DayRange[] {
  const scale = createThirdScale({ startDateIso, totalDays, minUnitWidth: 1 });
  return scale.ticks
    .map((_, i) => scale.tickToDayRange(i))
    .filter((v): v is DayRange => !!v);
}

export function paintSpanOnDayCells<
  T extends {
    cropId?: string;
    cropName?: string;
    cropStart?: boolean;
    cropEnd?: boolean;
    events?: unknown[];
  },
>(
  cells: T[],
  span: {
    startIndex: number;
    endIndex: number;
    cropId: string;
    cropName: string;
  },
  thirdRanges: DayRange[],
): void {
  const clamp = (v: number) => Math.max(0, Math.min(v, cells.length - 1));
  for (let ti = span.startIndex; ti <= span.endIndex; ti += 1) {
    const rng = thirdRanges[ti];
    if (!rng) continue;
    const isFirstThird = ti === span.startIndex;
    const isLastThird = ti === span.endIndex;
    const start = clamp(rng.startDay);
    const end = clamp(rng.endDay);
    for (let di = start; di <= end; di += 1) {
      const cell = cells[di];
      const nextStart =
        (cell.cropStart ?? false) || (isFirstThird && di === start);
      const nextEnd = (cell.cropEnd ?? false) || (isLastThird && di === end);
      cells[di] = {
        ...cell,
        cropId: span.cropId,
        cropName: span.cropName,
        cropStart: nextStart || undefined,
        cropEnd: nextEnd || undefined,
      } as T;
    }
  }
}

export function thirdStartDay(
  thirdRanges: DayRange[],
  thirdIndex: number,
): number {
  const r = thirdRanges[thirdIndex];
  return r ? r.startDay : -1;
}
