import { cn } from "@/lib/cn";

/**
 * Status badges pair a shape glyph with a word, so they stay readable in
 * greyscale and for color-blind viewers. Color alone never carries the status.
 */
type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-text-secondary",
  success: "bg-success-subtle text-success-on-subtle",
  warning: "bg-warning-subtle text-warning-on-subtle",
  danger: "bg-danger-subtle text-danger-on-subtle",
  accent: "bg-accent-subtle text-accent-hover",
};

export function Badge({
  tone = "neutral",
  glyph,
  children,
  className,
}: {
  tone?: Tone;
  glyph?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-[5px] rounded-sm px-[7px] text-[11px] font-semibold",
        TONES[tone],
        className,
      )}
    >
      {glyph && <span aria-hidden>{glyph}</span>}
      {children}
    </span>
  );
}

/** The three ad-account states a client row can be in. */
export function AdAccountBadge({ state }: { state: "connected" | "missing" | "expired" }) {
  if (state === "connected") return <Badge tone="success" glyph="●">Connected</Badge>;
  if (state === "expired") return <Badge tone="danger" glyph="!">Token expired</Badge>;
  return <Badge tone="warning" glyph="▲">No ad account</Badge>;
}
