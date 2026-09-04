"use client";

import { useState } from "react";

import { PreviewDialog } from "@/components/launch/preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface Variation {
  id: string;
  headline: string;
  primary_text: string;
  angle: string | null;
  status: string;
  meta_ad_id: string | null;
  error: string | null;
  creatives: { image_url: string } | null;
}

/**
 * The review gate.
 *
 * Drafts are reviewed before they reach Meta; once pushed they exist as PAUSED
 * ads and are reviewed again as the real thing. Rejecting a pushed ad deletes
 * it from the account, which is why it asks first.
 */
export function ReviewGrid({
  variations,
  busy,
  progress,
  canPush,
  pushedCount,
  onPush,
  onReject,
  onRefresh,
  onPair,
}: {
  variations: Variation[];
  busy: string | null;
  progress: { completed: number; total: number } | null;
  canPush: boolean;
  pushedCount: number;
  onPush: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
  onRefresh: () => void;
  onPair?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState<string | null>(null);

  const drafts = variations.filter((v) => v.status === "draft");
  const pushed = variations.filter((v) => v.status === "pushed");
  const failed = variations.filter((v) => v.status === "failed");

  const shown = drafts.length > 0 ? drafts : pushed.length > 0 ? pushed : variations;
  const unpaired = shown.filter((v) => !v.creatives?.image_url);
  const reviewingDrafts = drafts.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedIds = [...selected].filter((id) => shown.some((v) => v.id === id));
  const targetIds = selectedIds.length > 0 ? selectedIds : shown.map((v) => v.id);

  return (
    <div className="rounded-lg border border-border bg-surface shadow-raised">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-5 py-3">
        <h2 className="text-[15px] font-semibold">
          {reviewingDrafts ? "Review before launch" : "Paused drafts in Meta"}
        </h2>
        <span className="tabular text-[12px] text-text-secondary">
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : `${shown.length} ads`}
        </span>

        {pushedCount > 0 && reviewingDrafts && (
          <Badge tone="accent">{pushedCount} already in Meta</Badge>
        )}
        {failed.length > 0 && (
          <Badge tone="danger" glyph="!">{failed.length} failed</Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button size="row" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          )}
          {reviewingDrafts ? (
            <Button
              variant="primary"
              disabled={!canPush || busy !== null}
              onClick={() => onPush(targetIds)}
            >
              {busy === "push"
                ? "Creating…"
                : `Launch ${targetIds.length} as paused drafts`}
            </Button>
          ) : (
            <>
              <Button onClick={onRefresh} disabled={busy !== null}>Refresh</Button>
              <Button
                variant="danger"
                disabled={busy !== null || targetIds.length === 0}
                onClick={() => {
                  if (
                    confirm(
                      `Delete ${targetIds.length} ad${targetIds.length === 1 ? "" : "s"} from Meta? This removes the paused drafts from the ad account.`,
                    )
                  ) {
                    onReject(targetIds);
                  }
                }}
              >
                {busy === "reject" ? "Removing…" : `Reject ${targetIds.length}`}
              </Button>
            </>
          )}
        </div>
      </div>

      {!canPush && reviewingDrafts && (
        <p className="border-b border-border bg-warning-subtle px-5 py-2 text-[12px] text-warning-on-subtle">
          ▲ Choose an ad set before launching.
        </p>
      )}

      {unpaired.length > 0 && reviewingDrafts && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-warning-subtle px-5 py-2">
          <p className="text-[12px] text-warning-on-subtle">
            ▲ {unpaired.length} {unpaired.length === 1 ? "ad has" : "ads have"} no image yet.
            They pair automatically at launch, or pair them now to see the result first.
          </p>
          {onPair && (
            <Button size="row" onClick={onPair}>Pair with creatives</Button>
          )}
        </div>
      )}

      {progress && (
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center justify-between text-[12px] text-text-secondary">
            <span>{progress.completed} of {progress.total}</span>
            <span className="tabular">
              {Math.round((progress.completed / Math.max(progress.total, 1)) * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${(progress.completed / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      <ul className="grid gap-4 p-5 md:grid-cols-2">
        {shown.map((v) => {
          const isSelected = selected.has(v.id);
          return (
            <li key={v.id}>
              <article
                onClick={() => toggle(v.id)}
                className={cn(
                  "cursor-pointer overflow-hidden rounded-lg border transition-colors duration-150",
                  isSelected ? "border-accent bg-accent-subtle" : "border-border bg-surface hover:bg-surface-muted",
                )}
              >
                <div className="flex gap-3 p-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                    {v.creatives?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.creatives.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-text-tertiary">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[13px] font-semibold">{v.headline}</h3>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {v.angle && (
                          <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
                            {v.angle}
                          </span>
                        )}
                        {/* Stops the click short of the card, so looking at an
                            ad never changes what is selected for launch. */}
                        <Button
                          size="row"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewing(v.id);
                          }}
                        >
                          Preview
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-[1.5] whitespace-pre-line text-text-secondary">
                      {v.primary_text}
                    </p>
                  </div>
                </div>

                {(v.status === "failed" || v.meta_ad_id) && (
                  <div className="border-t border-border px-3 py-2">
                    {v.status === "failed" ? (
                      <p className="text-[11px] text-danger-on-subtle">! {v.error}</p>
                    ) : (
                      <p className="font-mono text-[11px] text-text-tertiary">
                        Ad {v.meta_ad_id} · paused
                      </p>
                    )}
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>

      {previewing && (
        <PreviewDialog
          variations={shown}
          startId={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}
