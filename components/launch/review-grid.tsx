"use client";

import { useState } from "react";

import { PreviewDialog } from "@/components/launch/preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { hasDash } from "@/lib/generation/dashes";
import { validateBoatClubVariation, validateVariation } from "@/lib/generation/validate";

export interface Variation {
  id: string;
  headline: string;
  primary_text: string;
  angle: string | null;
  status: string;
  meta_ad_id: string | null;
  error: string | null;
  /** Set when the ad launched with less than it asked for. */
  push_note: string | null;
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
  industry,
  onPush,
  onReject,
  onRefresh,
  onDiscard,
  onFixDashes,
  onPair,
}: {
  variations: Variation[];
  busy: string | null;
  progress: { completed: number; total: number } | null;
  canPush: boolean;
  pushedCount: number;
  industry: string;
  onPush: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
  onRefresh: () => void;
  onDiscard: (ids: string[]) => void;
  onFixDashes: (ids: string[]) => void;
  onPair?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState<string | null>(null);

  // The copy rules are pure functions, so they run here against whatever is on
  // screen rather than being computed once at generation and thrown away. That
  // also covers imported copy and stays current when a rule changes.
  const validate = industry === "boat_club" ? validateBoatClubVariation : validateVariation;

  const drafts = variations.filter((v) => v.status === "draft");
  const pushed = variations.filter((v) => v.status === "pushed");
  const failed = variations.filter((v) => v.status === "failed");

  // Everything, always.
  //
  // This grid has hidden the card that mattered twice now: failures while
  // drafts remained, then ads that pushed while drafts remained. Both times a
  // count in the header pointed at something not on screen, and the second
  // time it made a fallback look like a success. Whatever is on the screen
  // should be everything there is; status is what the cards are for.
  const pending = variations.filter((v) => v.status === "draft" || v.status === "failed");
  const shown = [...pending, ...pushed];
  const unpaired = shown.filter((v) => !v.creatives?.image_url);
  const reviewingDrafts = pending.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // House rule: no dashes in ad copy. Generated copy rarely has them now, but
  // imported copy arrives however it was written.
  const dashed = shown.filter(
    (v) =>
      (v.status === "draft" || v.status === "failed") &&
      (hasDash(v.headline) || hasDash(v.primary_text)),
  );

  const selectedIds = [...selected].filter((id) => shown.some((v) => v.id === id));
  const targetIds = selectedIds.length > 0 ? selectedIds : shown.map((v) => v.id);

  // Launching and discarding only ever apply to what has not reached Meta.
  // Now that pushed ads are listed alongside drafts, "all of them" has to mean
  // all of the ones those buttons can act on.
  const launchable = targetIds.filter((id) =>
    pending.some((v) => v.id === id),
  );

  // Rejecting removes an ad from the account, so it only applies to ads that
  // reached it. A failed variation has nothing in Meta to remove.
  const rejectable = targetIds.filter((id) =>
    variations.some((v) => v.id === id && v.status === "pushed"),
  );

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
          <Badge tone="accent">{pushedCount} already in Meta, below</Badge>
        )}
        {failed.length > 0 && (
          <Badge tone="danger" glyph="!">
            {failed.length} failed, retried on relaunch
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button size="row" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          )}
          {reviewingDrafts ? (
            <>
              {/* A draft has never reached Meta, so throwing one away is a
                  local delete — nothing to undo in the ad account. */}
              <Button
                variant="danger"
                disabled={busy !== null || launchable.length === 0}
                onClick={() => {
                  const what =
                    selectedIds.length > 0
                      ? `${launchable.length} selected ad${launchable.length === 1 ? "" : "s"}`
                      : `all ${launchable.length} ads`;
                  if (confirm(`Discard ${what}? They have not been sent to Meta, so this only removes them here.`)) {
                    onDiscard(launchable);
                  }
                }}
              >
                {busy === "discard" ? "Discarding…" : `Discard ${launchable.length}`}
              </Button>
              <Button
                variant="primary"
                disabled={!canPush || busy !== null || launchable.length === 0}
                onClick={() => onPush(launchable)}
              >
                {busy === "push"
                  ? "Creating…"
                  : `Launch ${launchable.length} as paused drafts`}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onRefresh} disabled={busy !== null}>Refresh</Button>
              <Button
                variant="danger"
                disabled={busy !== null || rejectable.length === 0}
                onClick={() => {
                  if (
                    confirm(
                      `Delete ${rejectable.length} ad${rejectable.length === 1 ? "" : "s"} from Meta? This removes the paused drafts from the ad account.`,
                    )
                  ) {
                    onReject(rejectable);
                  }
                }}
              >
                {busy === "reject" ? "Removing…" : `Reject ${rejectable.length}`}
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

      {dashed.length > 0 && reviewingDrafts && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-warning-subtle px-5 py-2">
          <p className="text-[12px] text-warning-on-subtle">
            ▲ {dashed.length} {dashed.length === 1 ? "ad uses" : "ads use"} a dash. Rewriting
            keeps every claim and only changes the punctuation around it.
          </p>
          <Button
            size="row"
            disabled={busy !== null}
            onClick={() => onFixDashes(dashed.map((v) => v.id))}
          >
            {busy === "dashes" ? "Rewriting…" : "Rewrite without dashes"}
          </Button>
        </div>
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
          const warnings = validate({ headline: v.headline, primary_text: v.primary_text });
          return (
            <li key={v.id}>
              <article
                onClick={() => toggle(v.id)}
                className={cn(
                  "cursor-pointer overflow-hidden rounded-lg border transition-colors duration-150",
                  isSelected
                    ? "border-accent bg-accent-subtle"
                    : v.status === "failed"
                      ? "border-danger-border bg-danger-subtle hover:bg-surface-muted"
                      : "border-border bg-surface hover:bg-surface-muted",
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

                {warnings.length > 0 && (
                  <ul className="border-t border-border bg-warning-subtle px-3 py-2">
                    {warnings.map((w) => (
                      <li key={w.rule + w.detail} className="text-[11px] leading-[1.45] text-warning-on-subtle">
                        ▲ {w.detail}
                      </li>
                    ))}
                  </ul>
                )}

                {(v.status === "failed" || v.meta_ad_id) && (
                  <div className="border-t border-border px-3 py-2">
                    {v.status === "failed" ? (
                      <p className="text-[11px] leading-[1.45] text-danger-on-subtle">
                        <span className="font-[550]">Not created. </span>
                        {v.error}
                      </p>
                    ) : (
                      <p className="font-mono text-[11px] text-text-tertiary">
                        Ad {v.meta_ad_id} · paused
                      </p>
                    )}
                    {/* A push that succeeded with less than it asked for says
                        so, or the next batch is built on a stale assumption. */}
                    {v.push_note && (
                      <p className="mt-1 text-[11px] leading-[1.45] text-warning-on-subtle">
                        ▲ {v.push_note}
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
