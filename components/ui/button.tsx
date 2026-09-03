import { forwardRef } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "default" | "row";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent border border-accent text-accent-text hover:bg-accent-hover hover:border-accent-hover",
  secondary:
    "bg-surface border border-border-strong text-text-primary hover:bg-background",
  ghost:
    "border border-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary",
  // Danger reads as quiet until hovered, so a destructive action never looks
  // like the default choice.
  danger:
    "bg-surface border border-[#e7c6c2] text-danger hover:bg-danger hover:border-danger hover:text-white",
};

const SIZES: Record<Size, string> = {
  default: "h-8 px-3 text-[13px] font-[550] rounded-md",
  row: "h-[26px] px-2 text-[12px] font-[550] rounded-[5px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "default", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap outline-none",
        "transition-[background-color,border-color,color] duration-150 ease-out",
        // Disabled dims without changing hue, so the variant stays legible.
        "disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none",
        variant === "danger" ? "focus-visible:focus-ring-danger" : "focus-visible:focus-ring",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
