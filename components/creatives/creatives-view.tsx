"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { groupByStem, groupKey } from "@/lib/creatives/filenames";
import { ACCEPTED_TYPES, prepareImage, storagePath, type PreparedImage } from "@/lib/creatives/image";
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
  creative_assets: Array<{
    id: string;
    ratio: Ratio;
    image_url: string;
    derived: boolean;
    meta_image_hash: string | null;
  }>;
}

export function CreativesView({ clients }: { clients: ClientOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);
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
        "id, image_url, label, meta_image_hash, archived, source, has_baked_text, width, height, creative_assets(id, ratio, image_url, derived, meta_image_hash)",
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
  // Counted in images, not creatives. Every size is its own upload to Meta and
  // its own hash, so five creatives each missing a vertical and a horizontal
  // is ten uploads, and saying "5" would understate the work by two thirds.
  const unsyncedImages = creatives
    .filter((c) => !c.archived)
    .reduce(
      (n, c) =>
        n +
        (c.meta_image_hash ? 0 : 1) +
        c.creative_assets.filter((a) => !a.meta_image_hash).length,
      0,
    );

  // Active creatives with nothing to serve a story or reel with. They still
  // launch — Meta fits the square into the frame — but a fitted square is a
  // letterboxed ad, and this is the one-click fix.
  const missingVertical = creatives.filter(
    (c) =>
      !c.archived &&
      ratioOf(c.width ?? 1, c.height ?? 1) !== "vertical" &&
      !c.creative_assets.some((a) => a.ratio === "vertical"),
  ).length;

  async function upload(files: FileList | File[]) {
    if (!clientId) return;
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });
    setMessage(null);

    const supabase = createClient();
    const failures: string[] = [];

    // Files named for the same ad are the same ad. A designer exporting one
    // creative in three ratios names them "storage-1x1", "storage-9x16",
    // "storage-1200x628", so dropping the set in makes one creative with three
    // renditions rather than three creatives that happen to look alike.
    const groups = groupByStem(list, (f) => f.name);
    let done = 0;
    let sets = 0;

    for (const group of groups) {
      try {
        // Prepared first: the file's dimensions decide its ratio, not its
        // name. A renamed export is exactly how a story gets called a square.
        const prepared = await Promise.all(
          group.files.map(async (file) => {
            // WebP is converted to JPEG here, Meta rejects WebP outright.
            const image = await prepareImage(file);
            return { file, image, ratio: ratioOf(image.width, image.height) };
          }),
        );

        // The square is the primary: it is what every existing creative is,
        // and it is the shape Meta falls back to for any placement without a
        // rule of its own.
        const primary = prepared.find((p) => p.ratio === "square") ?? prepared[0]!;
        const rest = prepared.filter((p) => p !== primary);

        async function store(image: PreparedImage) {
          const path = storagePath(clientId, image.extension);
          const { error } = await supabase.storage
            .from("creatives")
            .upload(path, image.blob, { contentType: image.contentType });
          if (error) throw new Error(error.message);
          const {
            data: { publicUrl },
          } = supabase.storage.from("creatives").getPublicUrl(path);
          return { path, publicUrl };
        }

        // A set can arrive in instalments: the square today, the vertical
        // once the designer sends it. When something already carries this
        // name, the new files join it instead of becoming a second creative.
        const existing = creatives.find(
          (c) => !c.archived && c.label && groupKey(c.label) === group.key,
        );

        if (existing) {
          for (const item of prepared) {
            const itemStored = await store(item.image);
            const { error: assetError } = await supabase.from("creative_assets").upsert(
              {
                creative_id: existing.id,
                ratio: item.ratio,
                storage_path: itemStored.path,
                image_url: itemStored.publicUrl,
                width: item.image.width,
                height: item.image.height,
                derived: false,
                // A replaced file is a different image, so the old hash is void.
                meta_image_hash: null,
              },
              { onConflict: "creative_id,ratio" },
            );
            if (assetError) throw new Error(assetError.message);
            done += 1;
            setUploading({ done, total: list.length });
          }
          sets += 1;
          continue;
        }

        const stored = await store(primary.image);

        // The label is what a spreadsheet's Image column matches on and what a
        // later upload of another size groups against, so a blank one falls
        // back to the filename rather than staying empty.
        const { data: created, error: insertError } = await supabase
          .from("creatives")
          .insert({
            client_id: clientId,
            storage_path: stored.path,
            image_url: stored.publicUrl,
            label: label.trim() || group.stem,
            source: "upload",
            width: primary.image.width,
            height: primary.image.height,
          })
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        done += 1;
        setUploading({ done, total: list.length });

        for (const extra of rest) {
          // The primary already covers its own shape; a second file of the
          // same ratio would give the push two images for one placement.
          if (extra.ratio === primary.ratio) {
            failures.push(
              `${extra.file.name} is the same shape as ${primary.file.name}, so it was skipped.`,
            );
            done += 1;
            setUploading({ done, total: list.length });
            continue;
          }

          const extraStored = await store(extra.image);
          const { error: assetError } = await supabase.from("creative_assets").upsert(
            {
              creative_id: created.id,
              ratio: extra.ratio,
              storage_path: extraStored.path,
              image_url: extraStored.publicUrl,
              width: extra.image.width,
              height: extra.image.height,
              derived: false,
            },
            { onConflict: "creative_id,ratio" },
          );
          if (assetError) throw new Error(assetError.message);
          done += 1;
          setUploading({ done, total: list.length });
        }

        if (prepared.length > 1) sets += 1;
      } catch (err) {
        failures.push(err instanceof Error ? err.message : `${group.stem} failed`);
        done += group.files.length;
        setUploading({ done, total: list.length });
      }
    }

    setUploading(null);
    setLabel("");
    if (failures.length) {
      setMessage({ tone: "error", text: failures.join(" · ") });
    } else {
      setMessage({
        tone: "ok",
        text:
          sets > 0
            ? `Uploaded ${list.length} images as ${groups.length} creative${groups.length === 1 ? "" : "s"}, ${sets} of them with more than one size.`
            : `Uploaded ${list.length} image${list.length === 1 ? "" : "s"}.`,
      });
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

  /**
   * Builds the sizes a creative is missing, for creatives nobody has a
   * designed vertical for.
   */
  async function fillSizes(creativeId?: string) {
    if (!clientId) return;
    setFilling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/creatives/fill-sizes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, creativeId, ratios: ["vertical"] }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ tone: "error", text: body.error ?? "Could not build the missing sizes" });
        return;
      }
      setMessage(
        body.built > 0
          ? {
              tone: "ok",
              text: `Built ${body.built} vertical version${body.built === 1 ? "" : "s"}. Check them in the ad preview before launching.`,
            }
          : { tone: "ok", text: "Nothing was missing a vertical." },
      );
      void load();
    } catch {
      setMessage({ tone: "error", text: "Could not build the missing sizes" });
    } finally {
      setFilling(false);
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
          text: `Uploaded ${body.synced} image${body.synced === 1 ? "" : "s"} to Meta${
            body.failed ? `, ${body.failed} failed` : ""
          }.`,
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
              {missingVertical > 0 && (
                <Button
                  onClick={() => void fillSizes()}
                  disabled={filling}
                  title="Places each square whole on a 9:16 canvas over a blurred fill of itself. Nothing is cropped, so a designed image keeps its headline and badge."
                >
                  {filling ? "Building…" : `Build ${missingVertical} vertical`}
                </Button>
              )}
              {unsyncedImages > 0 && (
                <Button
                  onClick={syncToMeta}
                  disabled={syncing || !client?.meta_ad_account_id}
                  title="Uploads every size that Meta does not have yet. Each aspect ratio is a separate image in the ad account."
                >
                  {syncing
                    ? "Uploading…"
                    : `Sync ${unsyncedImages} image${unsyncedImages === 1 ? "" : "s"} to Meta`}
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
                  <p className="mt-1 text-[12px] text-text-tertiary">
                    Files named alike are one creative in several sizes:{" "}
                    <span className="font-mono">storage-1x1.jpg</span> and{" "}
                    <span className="font-mono">storage-9x16.jpg</span> upload together, and a
                    size sent later joins the creative already named for it.
                  </p>
                </>
              )}
            </div>

            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label. Leave blank to name each creative after its file."
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
                        {!creative.meta_image_hash ? (
                          <Badge tone="warning" glyph="▲">Not uploaded</Badge>
                        ) : creative.creative_assets.some((a) => !a.meta_image_hash) ? (
                          <span title="The main image is on Meta but another size is not. It uploads on push, or sync now to get it out of the way.">
                            <Badge tone="warning" glyph="▲">Sizes pending</Badge>
                          </span>
                        ) : (
                          <Badge tone="success" glyph="●">On Meta</Badge>
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
  const derived = new Set<Ratio>(
    creative.creative_assets.filter((a) => a.derived).map((a) => a.ratio),
  );

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {RATIOS.map((ratio) => (
        <span
          key={ratio}
          title={
            derived.has(ratio)
              ? `${RATIO_HINTS[ratio]} — built from the square, not designed for this shape`
              : RATIO_HINTS[ratio]
          }
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-[10px] font-[550]",
            !have.has(ratio)
              ? "bg-surface-muted text-text-tertiary"
              : derived.has(ratio)
                ? "bg-warning-subtle text-warning-on-subtle"
                : "bg-success-subtle text-success-on-subtle",
          )}
        >
          {!have.has(ratio) ? "○" : derived.has(ratio) ? "◐" : "●"} {RATIO_LABELS[ratio]}
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
