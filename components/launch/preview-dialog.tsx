"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import type { Variation } from "./review-grid";

/**
 * The five placements worth checking before launch. Meta's preview endpoint
 * takes many more, but these are the ones these ads actually run in, and each
 * crops the image and truncates the copy differently.
 */
const FORMATS = [
  { value: "MOBILE_FEED_STANDARD", label: "Facebook feed" },
  { value: "INSTAGRAM_STANDARD", label: "Instagram feed" },
  { value: "INSTAGRAM_STORY", label: "Instagram story" },
  { value: "FACEBOOK_STORY_MOBILE", label: "Facebook story" },
  { value: "DESKTOP_FEED_STANDARD", label: "Desktop feed" },
] as const;

type Format = (typeof FORMATS)[number]["value"];

interface Rendered {
  src: string;
  width: number;
  height: number;
}

/**
 * Renders the ad through Meta's own preview endpoint, so what is on screen is
 * what the account will show — not a mockup that guesses at cropping and the
 * "... more" truncation point.
 *
 * Nothing here creates an ad; the preview is generated from the creative spec
 * alone, so it costs nothing to look before pushing.
 */
export function PreviewDialog({
  variations,
  startId,
  onClose,
}: {
  variations: Variation[];
  startId: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(() => {
    const at = variations.findIndex((v) => v.id === startId);
    return at === -1 ? 0 : at;
  });
  const [format, setFormat] = useState<Format>("MOBILE_FEED_STANDARD");
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Previews take a Graph round trip each, and users flip back and forth
  // between placements. Once rendered, a pair stays rendered.
  const cache = useRef(new Map<string, Rendered>());

  const variation = variations[index];
  const key = variation ? `${variation.id}:${format}` : null;

  const load = useCallback(async () => {
    if (!variation || !key) return;

    const hit = cache.current.get(key);
    if (hit) {
      setRendered(hit);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setRendered(null);
    try {
      const res = await fetch("/api/meta/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variationId: variation.id, format }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not render a preview");
        return;
      }
      const next: Rendered = { src: body.src, width: body.width, height: body.height };
      cache.current.set(key, next);
      setRendered(next);
    } catch {
      setError("Could not reach Meta");
    } finally {
      setLoading(false);
    }
  }, [variation, key, format]);

  useEffect(() => {
    void load();
  }, [load]);

  const move = useCallback(
    (by: number) => {
      setIndex((i) => Math.min(Math.max(i + by, 0), variations.length - 1));
    },
    [variations.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, move]);

  if (!variation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[rgb(23_23_26_/_0.28)]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ad preview"
        className="relative flex max-h-[88vh] w-[520px] flex-col rounded-xl bg-surface shadow-[var(--shadow-modal)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold">Ad preview</h2>
            <p className="mt-0.5 truncate text-[13px] text-text-secondary">{variation.headline}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-text-tertiary hover:bg-surface-muted hover:text-text-primary"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-1 border-b border-border px-6 py-2.5">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={cn(
                "rounded-md px-2 py-1 text-[12px] font-[550] transition-colors duration-150",
                format === f.value
                  ? "bg-accent-subtle text-accent"
                  : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-background px-6 py-5">
          {error ? (
            <div className="max-w-[320px] text-center">
              <p className="text-[13px] text-danger-on-subtle">{error}</p>
              <Button size="row" className="mt-3" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : loading || !rendered ? (
            <p className="text-[13px] text-text-tertiary">Rendering with Meta…</p>
          ) : (
            <iframe
              key={rendered.src}
              src={rendered.src}
              title="Ad preview"
              width={rendered.width}
              height={rendered.height}
              className="max-w-full rounded-md border-0 bg-surface"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
          <span className="tabular text-[12px] text-text-secondary">
            {index + 1} of {variations.length}
          </span>
          <div className="flex items-center gap-2">
            <Button size="row" disabled={index === 0} onClick={() => move(-1)}>
              ← Previous
            </Button>
            <Button size="row" disabled={index === variations.length - 1} onClick={() => move(1)}>
              Next →
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
