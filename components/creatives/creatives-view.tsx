"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { ACCEPTED_TYPES, prepareImage, storagePath } from "@/lib/creatives/image";
import { ratioOf, RATIO_HINTS, RATIO_LABELS, RATIOS, type Ratio } from "@/lib/creatives/ratios";
import { createClient } from "@/lib/supabase/client";
import { GenerateDialog } from "@/components/creatives/generate-dialog";
import { sceneOptions } from "@/lib/generation/images/labels";

interface ClientOption {
  id: string;
  name: string;
  meta_ad_account_id: string | null;
  industry: string;
  marine_business_types: string[] | null;
}

interface Creative {
  id: string;
  image_url: string;
  label: string | null;
  meta_image_hash: string | null;
  archived: boolean;
  source: string;
  /** NULL until examined. Non-false blocks Meta placement cropping. */
  has_baked_text: boolean | null;
  width: number | null;
  height: number | null;
  /** Extra aspect-ratio renditions, each delivered to its own placements. */
  creative_assets: Array<{ id: string; ratio: Ratio; image_url: string }>;
}

export function CreativesView({ clients }: { clients: ClientOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const client = clients.find((c) => c.id === clientId);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("creatives")
      .select(
        "id, image_url, label, meta_image_hash, archived, source, has_baked_text, width, height, creative_assets(id, ratio, image_url)",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setCreatives((data ?? []) as Creative[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = creatives.filter((c) => (showArchived ? c.archived : !c.archived));
  const archivedCount = creatives.filter((c) => c.archived).length;
  const unsynced = creatives.filter((c) => !c.archived && !c.meta_image_hash);

  async function upload(files: FileList | File[]) {
    if (!clientId) return;
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });
    setMessage(null);

    const supabase = createClient();
    const failures: string[] = [];

    for (const [i, file] of list.entries()) {
      try {
        // WebP is converted to JPEG here — Meta rejects WebP outright.
        const prepared = await prepareImage(file);
        const path = storagePath(clientId, prepared.extension);

        const { error: uploadError } = await supabase.storage
          .from("creatives")
          .upload(path, prepared.blob, { contentType: prepared.contentType });
        if (uploadError) throw new Error(uploadError.message);

        const {
          data: { publicUrl },
        } = supabase.storage.from("creatives").getPublicUrl(path);

        const { error: insertError } = await supabase.from("creatives").insert({
          client_id: clientId,
          storage_path: path,
          image_url: publicUrl,
          label: label.trim() || null,
          source: "upload",
          // Its own shape, so the push knows which placements it already
          // covers and which still need a rendition.
          width: prepared.width,
          height: prepared.height,
        });
        if (insertError) throw new Error(insertError.message);
      } catch (err) {
        failures.push(err instanceof Error ? err.message : `${file.name} failed`);
      }
      setUploading({ done: i + 1, total: list.length });
    }

    setUploading(null);
    setLabel("");
    if (failures.length) {
      setMessage({ tone: "error", text: failures.join(" · ") });
    } else {
      setMessage({ tone: "ok", text: `Uploaded ${list.length} image${list.length === 1 ? "" : "s"}.` });
    }
    void load();

    // Look at what was just uploaded: one pass records what each image depicts,
    // so copy can be written to it, and whether it carries its own headline or
    // offer badge, which decides whether Meta may crop it for a placement. Not
    // awaited — it is slow, and nothing on this screen waits on it.
    void fetch("/api/creatives/describe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId }),
    })
      .then(() => load())
      .catch(() => {
        // The launch flow runs the same pass before generating copy, so a
        // failure here costs nothing but a later wait.
      });
  }

  /**
   * Adds another aspect ratio to an existing creative.
   *
   * The file says what shape it is, so nothing is asked — a mislabelled asset
   * is worse than a missing one, because it sends a letterboxed square into
   * the slot a full-screen story was supposed to fill.
   */
  async function addAsset(creativeId: string, file: File) {
    if (!clientId) return;
    setAddingTo(creativeId);
    setMessage(null);
    try {
      const prepared = await prepareImage(file);
      const path = storagePath(clientId, prepared.extension);

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("creatives")
        .upload(path, prepared.blob, { contentType: prepared.contentType });
      if (uploadError) throw new Error(uploadError.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("creatives").getPublicUrl(path);

      const ratio = ratioOf(prepared.width, prepared.height);
      // Replacing a ratio rather than adding a second one: the push must never
      // have to choose between two images for the same placement. The stored
      // Meta hash goes with it, so the new file is uploaded on next push.
      const { error: insertError } = await supabase
        .from("creative_assets")
        .upsert(
          {
            creative_id: creativeId,
            ratio,
            storage_path: path,
            image_url: publicUrl,
            width: prepared.width,
            height: prepared.height,
            meta_image_hash: null,
          },
          { onConflict: "creative_id,ratio" },
        );
      if (insertError) throw new Error(insertError.message);

      setMessage({
        tone: "ok",
        text: `Added a ${RATIO_LABELS[ratio].toLowerCase()} version (${prepared.width}×${prepared.height}).`,
      });
      void load();
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not add that size",
      });
    } finally {
      setAddingTo(null);
    }
  }

  async function setArchived(id: string, archived: boolean) {
    await createClient().from("creatives").update({ archived }).eq("id", id);
    void load();
  }

  async function remove(creative: Creative) {
    if (!confirm("Delete this creative? The image is removed from storage too.")) return;
    const supabase = createClient();
    // Delete the object as well as the row. The old build orphaned objects —
    // 236 files backing 169 rows.
    const path = creative.image_url.split("/creatives/")[1];
    if (path) await supabase.storage.from("creatives").remove([decodeURIComponent(path)]);
    await supabase.from("creatives").delete().eq("id", creative.id);
    void load();
  }

  async function syncToMeta() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/creatives/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ tone: "error", text: body.error ?? "Sync failed" });
      } else {
        setMessage({
          tone: body.failed > 0 ? "error" : "ok",
          text: `Uploaded ${body.synced} to Meta${body.failed ? `, ${body.failed} failed` : ""}.`,
        });
      }
      void load();
    } finally {
      setSyncing(false);
    }
  }

  if (clients.length === 0) {
    return (
      <>
        <Header />
        <div className="mx-auto w-full max-w-[1120px] p-6">
          <div className="rounded-lg border border-border bg-surface shadow-raised">
            <EmptyState
              title="No clients yet"
              body="Creatives belong to a client. Add one first and its image library appears here."
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-[1120px] p-6">
        <div className="rounded-lg border border-border bg-surface shadow-raised">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-6 py-3">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              aria-label="Client"
              className="h-8 min-w-[220px] rounded-md border border-border-strong bg-surface px-2.5 text-[13px] outline-none focus:border-accent focus:focus-ring"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <span className="tabular text-[12px] text-text-secondary">
              {visible.length} {showArchived ? "archived" : "active"}
            </span>

            {archivedCount > 0 && (
              <button
                onClick={() => setShowArchived((s) => !s)}
                className="text-[12px] text-text-secondary hover:text-text-primary hover:underline"
              >
                {showArchived ? "Show active" : `Show archived (${archivedCount})`}
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              {unsynced.length > 0 && (
                <Button onClick={syncToMeta} disabled={syncing || !client?.meta_ad_account_id}>
                  {syncing ? "Uploading…" : `Sync ${unsynced.length} to Meta`}
                </Button>
              )}
              <Button onClick={() => fileInput.current?.click()}>Upload images</Button>
              <Button variant="primary" onClick={() => setGenerating(true)} disabled={!clientId}>
                Generate with AI
              </Button>
            </div>
          </div>

          {!client?.meta_ad_account_id && (
            <p className="border-b border-border bg-warning-subtle px-6 py-2 text-[12px] text-warning-on-subtle">
              ▲ This client has no ad account id, so images cannot be uploaded to Meta yet.
            </p>
          )}

          {message && (
            <p
              role="status"
              className={cn(
                "border-b border-border px-6 py-2 text-[12px]",
                message.tone === "ok"
                  ? "bg-success-subtle text-success-on-subtle"
                  : "bg-danger-subtle text-danger-on-subtle",
              )}
            >
              {message.text}
            </p>
          )}

          <div className="p-6">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = "";
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files?.length) void upload(e.dataTransfer.files);
              }}
              onClick={() => fileInput.current?.click()}
              className={cn(
                "cursor-pointer rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-150",
                dragging ? "border-accent bg-accent-subtle" : "border-border-strong hover:bg-surface-muted",
              )}
            >
              {uploading ? (
                <p className="text-[13px] text-text-secondary">
                  Uploading {uploading.done} of {uploading.total}…
                </p>
              ) : (
                <>
                  <p className="text-[13px] font-[550]">Drop images here, or click to choose</p>
                  <p className="mt-1 text-[12px] text-text-tertiary">
                    JPEG, PNG or WebP up to 20 MB. WebP is converted to JPEG automatically,
                    because Meta rejects it.
                  </p>
                </>
              )}
            </div>

            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label applied to this batch"
              className="mt-3 h-8 w-full rounded-md border border-border-strong bg-surface px-2.5 text-[13px] outline-none placeholder:text-text-tertiary focus:border-accent focus:focus-ring"
            />

            {loading ? (
              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-surface-muted" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="mt-2">
                <EmptyState
                  icon="⬚"
                  title={showArchived ? "Nothing archived" : "No creatives yet"}
                  body={
                    showArchived
                      ? "Archived images stay attached to any ads already made from them."
                      : "Upload images you already have, or generate them once the Launch flow is wired up."
                  }
                />
              </div>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {visible.map((creative) => (
                  <li key={creative.id} className="group relative">
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={creative.image_url}
                        alt={creative.label ?? "Ad creative"}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
                        {creative.meta_image_hash ? (
                          <Badge tone="success" glyph="●">On Meta</Badge>
                        ) : (
                          <Badge tone="warning" glyph="▲">Not uploaded</Badge>
                        )}
                        {/* Says why this image will run un-cropped: Meta's
                            placement reframing would cut the copy off it. */}
                        {creative.has_baked_text && (
                          <span title="This image has copy designed into it, so Meta is not allowed to crop it for other placements. It runs as authored.">
                            <Badge tone="accent">Text in image</Badge>
                          </span>
                        )}
                      </span>
                    </div>

                    <RatioRow
                      creative={creative}
                      busy={addingTo === creative.id}
                      onAdd={(file) => void addAsset(creative.id, file)}
                    />

                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">
                        {creative.label ?? (creative.source === "ai" ? "Generated" : "Uploaded")}
                      </span>
                      <Button
                        size="row"
                        variant="ghost"
                        onClick={() => setArchived(creative.id, !creative.archived)}
                      >
                        {creative.archived ? "Restore" : "Archive"}
                      </Button>
                      <Button
                        size="row"
                        variant="ghost"
                        className="hover:bg-danger-subtle hover:text-danger-on-subtle"
                        onClick={() => remove(creative)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {generating && client && (
        <GenerateDialog
          clientId={client.id}
          clientName={client.name}
          scenes={sceneOptions(client.industry, client.marine_business_types)}
          onClose={() => setGenerating(false)}
          onDone={() => void load()}
        />
      )}
    </>
  );
}

function Header() {
  return (
    <header className="flex h-[52px] shrink-0 items-center border-b border-border bg-surface px-8">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Creatives</h1>
    </header>
  );
}

/**
 * Which placements this creative can already be delivered to, and a way to
 * fill a gap.
 *
 * An ad with only a square still launches — it is fitted into a story rather
 * than cropped into one, so nothing is lost but the full frame. This row is
 * how that becomes visible before launch instead of after.
 */
function RatioRow({
  creative,
  busy,
  onAdd,
}: {
  creative: Creative;
  busy: boolean;
  onAdd: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  // The primary image covers its own shape; older rows predate the dimension
  // columns and are square, which every creative in the library then was.
  const primary =
    creative.width && creative.height ? ratioOf(creative.width, creative.height) : "square";
  const have = new Set<Ratio>([primary, ...creative.creative_assets.map((a) => a.ratio)]);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {RATIOS.map((ratio) => (
        <span
          key={ratio}
          title={RATIO_HINTS[ratio]}
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-[10px] font-[550]",
            have.has(ratio)
              ? "bg-success-subtle text-success-on-subtle"
              : "bg-surface-muted text-text-tertiary",
          )}
        >
          {have.has(ratio) ? "●" : "○"} {RATIO_LABELS[ratio]}
        </span>
      ))}

      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAdd(file);
          e.target.value = "";
        }}
      />
      <Button
        size="row"
        variant="ghost"
        disabled={busy}
        onClick={() => input.current?.click()}
        title="Upload another size of this same creative. Its dimensions decide which placements it serves."
      >
        {busy ? "Adding…" : "+ Size"}
      </Button>
    </div>
  );
}
