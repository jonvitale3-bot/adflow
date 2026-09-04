"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

interface Warning {
  rule: string;
  detail: string;
}

interface PreviewRow {
  rowNumber: number;
  headline: string;
  primary_text: string;
  image?: string;
  angle?: string;
  warnings: Warning[];
}

interface Preview {
  sheetName: string;
  headers: string[];
  mapping: Record<string, string | undefined>;
  total: number;
  problems: Array<{ rowNumber: number; message: string }>;
  preview: PreviewRow[];
}

const FIELDS: Array<{ key: string; label: string; required: boolean }> = [
  { key: "headline", label: "Headline", required: true },
  { key: "primary_text", label: "Primary text", required: true },
  { key: "image", label: "Image", required: false },
  { key: "angle", label: "Angle", required: false },
];

export function ImportDialog({
  clientId,
  clientName,
  onClose,
  onImported,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function parse(chosen: File, mapping?: Record<string, string | undefined>) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", chosen);
      if (mapping) form.append("mapping", JSON.stringify(mapping));

      const res = await fetch("/api/import/preview", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not read that file");
        return;
      }
      setPreview(body);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          rows: preview.preview.map(({ headline, primary_text, image, angle }) => ({
            headline,
            primary_text,
            image,
            angle,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Import failed");
        return;
      }
      onImported(body.imported);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const mappedOk = preview?.mapping.headline && preview?.mapping.primary_text;
  const warningCount = preview?.preview.reduce((n, r) => n + r.warnings.length, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[rgb(23_23_26_/_0.28)]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import copy"
        className="relative flex max-h-[85vh] w-[760px] flex-col rounded-xl bg-surface shadow-[var(--shadow-modal)]"
      >
        <header className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold">Import copy from a spreadsheet</h2>
            <p className="mt-0.5 text-[13px] text-text-secondary">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-text-tertiary hover:bg-surface-muted hover:text-text-primary"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <p className="mb-4 rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-[12px] text-danger-on-subtle">
              {error}
            </p>
          )}

          {!preview ? (
            <>
              <input
                ref={input}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) {
                    setFile(chosen);
                    void parse(chosen);
                  }
                  e.target.value = "";
                }}
              />
              <div
                onClick={() => input.current?.click()}
                className="cursor-pointer rounded-lg border border-dashed border-border-strong px-6 py-10 text-center hover:bg-surface-muted"
              >
                <p className="text-[13px] font-[550]">
                  {busy ? "Reading…" : "Choose a spreadsheet"}
                </p>
                <p className="mt-1 text-[12px] text-text-tertiary">
                  .xlsx or .csv, up to 5 MB. This app&rsquo;s own Excel export imports
                  with no mapping needed.
                </p>
              </div>
              <p className="mt-4 text-[12px] leading-[1.5] text-text-secondary">
                For a Google Sheet, use File → Download → Comma-separated values, then
                choose it here.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3.5">
                {FIELDS.map((field) => (
                  <Select
                    key={field.key}
                    label={field.label}
                    required={field.required}
                    value={preview.mapping[field.key] ?? ""}
                    onChange={(e) => {
                      const next = { ...preview.mapping, [field.key]: e.target.value || undefined };
                      if (file) void parse(file, next);
                    }}
                  >
                    <option value="">Not mapped</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-[12px]">
                <span className="tabular text-text-secondary">
                  {preview.total} row{preview.total === 1 ? "" : "s"} ready
                </span>
                {preview.problems.length > 0 && (
                  <span className="rounded-sm bg-warning-subtle px-1.5 py-0.5 text-warning-on-subtle">
                    ▲ {preview.problems.length} skipped
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-text-secondary">
                    {warningCount} rule warning{warningCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {warningCount > 0 && (
                <p className="mt-2 text-[12px] leading-[1.5] text-text-tertiary">
                  Warnings flag copy that breaks the house rules: banned CTA verbs, month
                  names, dashes, numeric social proof. They do not block the import; your
                  copy is your call.
                </p>
              )}

              {preview.problems.length > 0 && (
                <ul className="mt-3 space-y-0.5 rounded-md border border-border bg-background px-3 py-2">
                  {preview.problems.slice(0, 5).map((p) => (
                    <li key={p.rowNumber} className="text-[12px] text-text-secondary">
                      Row {p.rowNumber}: {p.message}
                    </li>
                  ))}
                  {preview.problems.length > 5 && (
                    <li className="text-[12px] text-text-tertiary">
                      and {preview.problems.length - 5} more
                    </li>
                  )}
                </ul>
              )}

              <ul className="mt-5 space-y-2">
                {preview.preview.slice(0, 20).map((row) => (
                  <li
                    key={row.rowNumber}
                    className="rounded-md border border-border px-3 py-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-semibold">{row.headline}</p>
                      <span className="tabular shrink-0 text-[11px] text-text-tertiary">
                        row {row.rowNumber}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-[1.5] whitespace-pre-line text-text-secondary">
                      {row.primary_text}
                    </p>
                    {row.warnings.length > 0 && (
                      <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
                        {row.warnings.map((w, i) => (
                          <li key={i} className="text-[11px] text-warning-on-subtle">
                            ▲ {w.detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-border px-6 py-3.5">
          <span className="text-[12px] text-text-tertiary">
            {preview && !mappedOk ? "Map a headline and primary text column to continue" : ""}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            {preview && (
              <Button
                variant="primary"
                disabled={busy || !mappedOk || preview.total === 0}
                onClick={commit}
              >
                {busy ? "Importing…" : `Import ${preview.total} as drafts`}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
