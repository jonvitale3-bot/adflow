"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

interface Props {
  clientId: string;
  clientName: string;
  scenes: Array<{ id: string; label: string }>;
  onClose: () => void;
  onDone: () => void;
}

interface Landed {
  index: number;
  url: string;
  scene: string | null;
}

const COUNTS = [3, 6, 9, 12];

export function GenerateDialog({ clientId, clientName, scenes, onClose, onDone }: Props) {
  const [count, setCount] = useState(6);
  const [scene, setScene] = useState("mixed");
  const [camera, setCamera] = useState<"phone" | "dslr">("phone");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [images, setImages] = useState<Landed[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  async function run() {
    setRunning(true);
    setImages([]);
    setErrors([]);
    setProgress({ completed: 0, total: count });

    const controller = new AbortController();
    abort.current = controller;

    try {
      const res = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, count, scene, camera }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setErrors([body.error ?? `Request failed (${res.status})`]);
        return;
      }

      // NDJSON: one JSON object per line, so images appear as they finish
      // rather than after the whole batch.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "image") {
            setImages((prev) => [
              ...prev,
              { index: event.index as number, url: event.url as string, scene: (event.scene as string) ?? null },
            ]);
          } else if (event.type === "progress") {
            setProgress({ completed: event.completed as number, total: event.total as number });
          } else if (event.type === "error") {
            setErrors((prev) => [...prev, `Image ${event.index}: ${event.message}`]);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setErrors((prev) => [...prev, (err as Error).message]);
      }
    } finally {
      setRunning(false);
      abort.current = null;
      onDone();
    }
  }

  function stop() {
    abort.current?.abort();
    setRunning(false);
  }

  const pct = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[rgb(23_23_26_/_0.28)]" onClick={running ? undefined : onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Generate images"
        className="relative flex max-h-[85vh] w-[640px] flex-col rounded-xl bg-surface shadow-[var(--shadow-modal)]"
      >
        <header className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold">Generate images</h2>
            <p className="mt-0.5 text-[13px] text-text-secondary">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={running}
            aria-label="Close"
            className="rounded p-1 text-text-tertiary hover:bg-surface-muted hover:text-text-primary disabled:opacity-45"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-3.5">
            <Select
              label="Images"
              value={String(count)}
              disabled={running}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {COUNTS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>

            <Select
              label="Scene"
              value={scene}
              disabled={running || scenes.length === 0}
              hint={scenes.length === 0 ? "No scene bank for this industry" : undefined}
              onChange={(e) => setScene(e.target.value)}
            >
              <option value="mixed">Mixed — one of each</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>

            <Select
              label="Look"
              value={camera}
              disabled={running}
              hint="Phone reads as a real photo; DSLR is more produced."
              onChange={(e) => setCamera(e.target.value as "phone" | "dslr")}
            >
              <option value="phone">Phone photo</option>
              <option value="dslr">DSLR</option>
            </Select>
          </div>

          {running && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-[12px] text-text-secondary">
                <span>
                  {progress.completed} of {progress.total} finished
                </span>
                <span className="tabular">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] text-text-tertiary">
                Each image takes 40–60 seconds. They appear here as they finish and are
                saved to the library automatically.
              </p>
            </div>
          )}

          {images.length > 0 && (
            <ul className="mt-5 grid grid-cols-3 gap-3">
              {images
                .slice()
                .sort((a, b) => a.index - b.index)
                .map((img) => (
                  <li key={img.index}>
                    <div className="aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.scene ?? "Generated"} className="h-full w-full object-cover" />
                    </div>
                    {img.scene && (
                      <p className="mt-1 truncate text-[11px] text-text-tertiary">{img.scene}</p>
                    )}
                  </li>
                ))}
            </ul>
          )}

          {errors.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-md border border-danger-border bg-danger-subtle px-3 py-2">
              {errors.map((e, i) => (
                <li key={i} className="text-[12px] text-danger-on-subtle">{e}</li>
              ))}
            </ul>
          )}
        </div>

        <footer className={cn("flex items-center justify-between gap-2 border-t border-border px-6 py-3.5")}>
          <span className="text-[12px] text-text-tertiary">
            {images.length > 0 && !running
              ? `${images.length} saved to the library`
              : "Images save automatically as they finish"}
          </span>
          <div className="flex gap-2">
            {running ? (
              <Button onClick={stop}>Stop</Button>
            ) : (
              <>
                <Button onClick={onClose}>Close</Button>
                <Button variant="primary" onClick={run}>
                  {images.length > 0 ? "Generate more" : "Generate"}
                </Button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
