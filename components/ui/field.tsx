"use client";

import { forwardRef, useId } from "react";

import { cn } from "@/lib/cn";

const CONTROL = [
  "w-full rounded-md border bg-surface px-2.5 text-[13px] text-text-primary outline-none",
  "transition-[border-color,box-shadow] duration-150 ease-out",
  "disabled:border-border disabled:bg-background disabled:text-text-tertiary",
  "placeholder:text-text-tertiary",
].join(" ");

function stateClasses(invalid: boolean, aiFilled: boolean): string {
  return cn(
    invalid
      ? "border-danger focus:focus-ring-danger"
      : "border-border-strong focus:border-accent focus:focus-ring",
    // A field the AI populated is tinted until the operator edits it, so it is
    // obvious at a glance what was generated rather than entered.
    aiFilled && !invalid && "bg-[#f7faff]",
  );
}

interface FieldShellProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldShell({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 text-[12px] font-[550] text-text-secondary">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 flex gap-[5px] text-[12px] leading-[1.4] text-danger-on-subtle">
          <span aria-hidden className="font-bold">!</span>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-[12px] leading-[1.4] text-text-tertiary">{hint}</p>
      )}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  aiFilled?: boolean;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, aiFilled = false, mono = false, className, id, required, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <FieldShell label={label} htmlFor={inputId} required={required} error={error} hint={hint}>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={cn(CONTROL, "h-[34px]", stateClasses(Boolean(error), aiFilled), mono && "font-mono", className)}
        {...props}
      />
    </FieldShell>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  aiFilled?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, aiFilled = false, className, id, required, children, ...props },
  ref,
) {
  const generated = useId();
  const selectId = id ?? generated;

  return (
    <FieldShell label={label} htmlFor={selectId} required={required} error={error} hint={hint}>
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          CONTROL,
          "h-[34px] appearance-none bg-[length:10px] bg-[right_10px_center] bg-no-repeat pr-8",
          // Chevron as an inline SVG so it inherits the tertiary token.
          "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 10 6%22 fill=%22none%22 stroke=%22%236E6E76%22 stroke-width=%221.5%22><path d=%22M1 1l4 4 4-4%22/></svg>')]",
          stateClasses(Boolean(error), aiFilled),
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  aiFilled?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, aiFilled = false, className, id, required, ...props },
  ref,
) {
  const generated = useId();
  const areaId = id ?? generated;

  return (
    <FieldShell label={label} htmlFor={areaId} required={required} error={error} hint={hint}>
      <textarea
        ref={ref}
        id={areaId}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          CONTROL,
          "min-h-[56px] resize-y py-2 leading-[1.5]",
          stateClasses(Boolean(error), aiFilled),
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
});
