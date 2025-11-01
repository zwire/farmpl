import { useEffect, useState } from "react";
import type { PlanUiState } from "@/lib/domain/planning-ui-types";
import { planningDraftStorage } from "@/lib/state/planning-store";

interface UseDraftPersistenceOptions {
  replacePlan: (plan: PlanUiState) => void;
  setLastSavedAt: (value: string | null) => void;
  markDirty: (dirty: boolean) => void;
}

interface UseDraftPersistenceResult {
  saveMessage: string | null;
  setSaveMessage: (message: string | null) => void;
}

export function useDraftPersistence({
  replacePlan,
  setLastSavedAt,
  markDirty,
}: UseDraftPersistenceOptions): UseDraftPersistenceResult {
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const draft = planningDraftStorage.load();
    if (!draft) return;
    replacePlan(draft.plan);
    setLastSavedAt(draft.savedAt ?? null);
    markDirty(false);
  }, [replacePlan, setLastSavedAt, markDirty]);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  return { saveMessage, setSaveMessage };
}
