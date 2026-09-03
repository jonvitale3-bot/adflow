import { cn } from "@/lib/cn";

/** Preserves row rhythm while loading. Tables never show a spinner. */
export function Skeleton({ width = 280, className }: { width?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width, backgroundSize: "280px 100%" }}
      className={cn(
        "block h-[11px] rounded-[3px]",
        "bg-[linear-gradient(90deg,#F0F0F2,#E7E7EA_40%,#F0F0F2_80%)]",
        "animate-[shimmer_1.3s_linear_infinite]",
        className,
      )}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block h-3.5 w-3.5 rounded-full border-2 border-[#B9CFF7] border-t-accent",
        "animate-[spin_0.7s_linear_infinite]",
        className,
      )}
    />
  );
}
