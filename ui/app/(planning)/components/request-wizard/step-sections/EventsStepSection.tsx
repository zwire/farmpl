"use client";

import { SectionCard } from "../SectionElements";
import type { ReadOnlyStepSectionProps } from "./types";

type EventsStepSectionProps = ReadOnlyStepSectionProps;

export function EventsStepSection({ plan }: EventsStepSectionProps) {
  return (
    <SectionCard
      title="イベント"
      description="イベント詳細はイベントエディタから編集してください"
      hasItems={plan.events.length > 0}
      emptyMessage="イベントが登録されていません。イベント依存のフローで追加してください。"
    >
      <p className="text-xs text-slate-500">
        イベントの追加・編集はイベント依存関係セクションで行えます。
      </p>
    </SectionCard>
  );
}
