import type { CategoryColor } from "./colorForCategory";

interface LegendItem {
  name: string;
  color: CategoryColor;
}

interface CategoryLegendProps {
  items: LegendItem[];
}

export const CategoryLegend = ({ items }: CategoryLegendProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      <span className="font-semibold">凡例:</span>
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color.background }}
          />
          <span>{item.name}</span>
        </div>
      ))}
    </div>
  );
};
