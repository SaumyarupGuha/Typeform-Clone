import Link from "next/link";
import { cn } from "@/lib/cn";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** When set the tab is a link (used by the builder's Create/Share/Results tabs). */
  href?: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange?: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn("flex gap-6", className)}>
      {items.map((item) => {
        const active = item.id === value;
        const classes = cn(
          "relative pb-2 pt-3 text-sm font-medium transition-colors",
          active ? "text-ink" : "text-ink-muted hover:text-ink",
        );
        // The bar above the active label mirrors Typeform's tab indicator.
        const indicator = active && <span className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-ink" />;

        return item.href ? (
          <Link key={item.id} href={item.href} role="tab" aria-selected={active} className={classes}>
            {indicator}
            {item.label}
          </Link>
        ) : (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(item.id)}
            className={classes}
          >
            {indicator}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
