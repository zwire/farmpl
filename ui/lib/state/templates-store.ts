import { create } from "zustand";

export type CropVariantItem = {
  template_id: string;
  label: string;
  variant?: string | null;
  price_per_a?: number | null;
  default_horizon_days?: number | null;
};

export type CropCatalogItem = {
  crop_name: string;
  category?: string | null;
  aliases?: string[];
  variants: CropVariantItem[];
};

type TemplatesState = {
  crops: CropCatalogItem[] | null;
  loading: boolean;
  error: string | null;
  fetchCropsOnce: () => void;
};

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  crops: null,
  loading: false,
  error: null,
  async fetchCropsOnce() {
    if (get().crops || get().loading) return;

    const base = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
    const apiKey = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
    const bearer = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";
    if (!base) return;

    set({ loading: true, error: null });
    try {
      const url = `${base.replace(/\/$/, "")}/v1/templates/crops`;
      const headers: Record<string, string> = {};
      if (apiKey) headers["X-API-Key"] = apiKey;
      if (bearer) headers.Authorization = `Bearer ${bearer}`;
      const resp = await fetch(url, { headers, cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as CropCatalogItem[];
      set({ crops: data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, loading: false });
    }
  },
}));

