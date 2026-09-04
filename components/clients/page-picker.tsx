"use client";

import { useCallback, useEffect, useState } from "react";

import { FieldShell } from "@/components/ui/field";
import { cn } from "@/lib/cn";

interface Page {
  id: string;
  name: string;
}

/**
 * Picks the Facebook Page a client's ads post as.
 *
 * Previously a free-text numeric id, which meant looking it up in Business
 * Manager and pasting it correctly for every client. Listing the Pages the
 * portfolio's token can actually act for also surfaces a missing Page
 * assignment here, rather than at push time when an ad fails.
 */
export function PagePicker({
  value,
  business,
  adAccountId,
  error,
  onChange,
}: {
  value: string;
  business: string | null;
  adAccountId: string | null;
  error?: string;
  onChange: (id: string) => void;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (business) params.set("business", business);
      if (adAccountId) params.set("adAccountId", adAccountId);
      const res = await fetch(`/api/meta/pages?${params}`);
      const body = await res.json();
      if (!res.ok) {
        setLoadError(body.error ?? "Could not load Pages");
        setPages([]);
        return;
      }
      setPages(body.pages ?? []);
    } catch {
      setLoadError("Could not load Pages");
    } finally {
      setLoading(false);
    }
  }, [business, adAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A saved id the token can no longer see must stay visible and editable
  // rather than silently vanishing from the control.
  const known = pages.some((p) => p.id === value);
  const useManual = manual || (!loading && (pages.length === 0 || (value !== "" && !known)));

  if (useManual) {
    return (
      <FieldShell
        label="Facebook Page"
        htmlFor="page-id"
        error={error}
        hint={
          loadError
            ? loadError
            : pages.length === 0
              ? "No Pages are available for this ad account. Assign Pages to the system user in Business Settings, or paste an id."
              : "This id is not among the Pages the token can see."
        }
      >
        <div className="flex gap-2">
          <input
            id="page-id"
            value={value}
            placeholder="102884471120397"
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "h-[34px] w-full rounded-md border bg-surface px-2.5 font-mono text-[13px] outline-none",
              error
                ? "border-danger focus:focus-ring-danger"
                : "border-border-strong focus:border-accent focus:focus-ring",
            )}
          />
          {pages.length > 0 && (
            <button
              type="button"
              onClick={() => setManual(false)}
              className="shrink-0 text-[12px] text-text-secondary hover:text-text-primary hover:underline"
            >
              Choose
            </button>
          )}
          {pages.length === 0 && (
            <button
              type="button"
              onClick={load}
              className="shrink-0 text-[12px] text-text-secondary hover:text-text-primary hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      </FieldShell>
    );
  }

  return (
    <FieldShell
      label="Facebook Page"
      htmlFor="page-select"
      error={error}
      hint={loading ? "Loading Pages…" : "Ads post as this Page."}
    >
      <div className="flex gap-2">
        <select
          id="page-select"
          value={value}
          disabled={loading}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-[34px] w-full appearance-none rounded-md border bg-surface bg-[length:10px] bg-[right_10px_center] bg-no-repeat px-2.5 pr-8 text-[13px] outline-none",
            "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 10 6%22 fill=%22none%22 stroke=%22%236E6E76%22 stroke-width=%221.5%22><path d=%22M1 1l4 4 4-4%22/></svg>')]",
            error
              ? "border-danger focus:focus-ring-danger"
              : "border-border-strong focus:border-accent focus:focus-ring",
          )}
        >
          <option value="">{loading ? "Loading…" : "Choose a Page…"}</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setManual(true)}
          className="shrink-0 text-[12px] text-text-secondary hover:text-text-primary hover:underline"
        >
          Enter id
        </button>
      </div>
    </FieldShell>
  );
}
