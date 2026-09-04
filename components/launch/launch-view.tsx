"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

import { DestinationPicker, type Destination } from "./destination";
import { ImportDialog } from "./import-dialog";
import { ReviewGrid, type Variation } from "./review-grid";

interface ClientRecord {
  id: string;
  name: string;
  industry: string;
  marine_business_type: string | null;
  meta_ad_account_id: string | null;
  meta_page_id: string | null;
  landing_page_url: string | null;
  location_description: string | null;
  market_name: string | null;
  season_type: string;
  current_promotion: string | null;
  business_type_description: string | null;
  offer_description: string | null;
  tone_keywords: string | null;
}

interface Defaults {
  client_id: string;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  instagram_account_id: string | null;
  default_batch_size: number;
}

type Stage = "setup" | "review";

export function LaunchView({
  clients,
  defaults,
}: {
  clients: ClientRecord[];
  defaults: Defaults[];
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [count, setCount] = useState(12);
  const [destination, setDestination] = useState<Destination>({
    campaignId: "",
    adSetId: "",
    instagramId: "",
  });
  const [variations, setVariations] = useState<Variation[]>([]);
  const [stage, setStage] = useState<Stage>("setup");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [creativeCount, setCreativeCount] = useState(0);
  const [importing, setImporting] = useState(false);

  const client = clients.find((c) => c.id === clientId);

  // The saved destination loads with the client, so a repeat launch needs no
  // re-picking.
  useEffect(() => {
    const saved = defaults.find((d) => d.client_id === clientId);
    setDestination({
      campaignId: saved?.meta_campaign_id ?? "",
      adSetId: saved?.meta_adset_id ?? "",
      instagramId: saved?.instagram_account_id ?? "",
    });
    if (saved?.default_batch_size) setCount(saved.default_batch_size);
    setVariations([]);
    setStage("setup");
    setMessage(null);
  }, [clientId, defaults]);

  useEffect(() => {
    if (!clientId) return;
    void createClient()
      .from("creatives")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("archived", false)
      .then(({ count: n }) => setCreativeCount(n ?? 0));
  }, [clientId, stage]);

  async function generate() {
    if (!client) return;
    setBusy("generate");
    setMessage(null);
    try {
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: client.name,
          locationDescription: client.location_description ?? client.name,
          industry: client.industry,
          seasonType: client.season_type,
          currentPromotion: client.current_promotion ?? undefined,
          businessTypeDescription: client.business_type_description ?? undefined,
          offerDescription: client.offer_description ?? undefined,
          toneKeywords: client.tone_keywords ?? undefined,
          count,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ tone: "error", text: body.error ?? "Generation failed" });
        return;
      }

      // Persist so a reload does not lose the batch, and pair with creatives.
      const saveRes = await fetch("/api/launch/variations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, variations: body.variations }),
      });
      const saved = await saveRes.json();
      if (!saveRes.ok) {
        setMessage({ tone: "error", text: saved.error ?? "Could not save variations" });
        return;
      }

      setVariations(saved.variations);
      setStage("review");
    } finally {
      setBusy(null);
    }
  }

  async function runJob(kind: "push" | "reject", ids: string[]) {
    if (ids.length === 0) return;
    setBusy(kind);
    setMessage(null);
    setProgress({ completed: 0, total: ids.length });

    try {
      const createRes = await fetch("/api/launch/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          kind,
          variationIds: ids,
          adSetId: kind === "push" ? destination.adSetId : undefined,
          campaignId: kind === "push" ? destination.campaignId : undefined,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        setMessage({ tone: "error", text: created.error ?? "Could not start" });
        return;
      }

      // Drive slices until nothing is left. A timeout costs one slice, and the
      // next call resumes where it stopped.
      let guard = 0;
      while (guard++ < 40) {
        const runRes = await fetch(`/api/launch/jobs/${created.jobId}/run`, { method: "POST" });
        const result = await runRes.json();
        if (!runRes.ok) {
          setMessage({ tone: "error", text: result.error ?? "Job failed" });
          return;
        }
        setProgress({ completed: result.completed + result.failed, total: ids.length });
        if (result.remaining === 0) {
          setMessage({
            tone: result.failed > 0 ? "error" : "ok",
            text:
              kind === "push"
                ? `${result.completed} ad${result.completed === 1 ? "" : "s"} created as paused drafts${result.failed ? `, ${result.failed} failed` : ""}.`
                : `${result.completed} removed from Meta${result.failed ? `, ${result.failed} failed` : ""}.`,
          });
          break;
        }
      }

      // Save the destination so the next launch for this client skips setup.
      if (kind === "push") {
        void fetch(`/api/clients/${clientId}/defaults`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            meta_campaign_id: destination.campaignId || null,
            meta_adset_id: destination.adSetId || null,
            instagram_account_id: destination.instagramId || null,
            default_batch_size: count,
          }),
        });
      }

      await refresh();
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function refresh() {
    const { data } = await createClient()
      .from("ad_variations")
      .select("id, headline, primary_text, angle, status, meta_ad_id, error, creatives(image_url)")
      .eq("client_id", clientId)
      .in("status", ["draft", "pushing", "pushed", "kept", "failed"])
      .order("created_at", { ascending: false });
    setVariations((data ?? []) as unknown as Variation[]);
  }

  const drafts = variations.filter((v) => v.status === "draft");
  const pushed = variations.filter((v) => v.status === "pushed");
  const canPush = Boolean(destination.adSetId) && drafts.length > 0;

  if (clients.length === 0) {
    return (
      <>
        <Header />
        <div className="mx-auto w-full max-w-[1120px] p-6">
          <div className="rounded-lg border border-border bg-surface shadow-raised">
            <EmptyState
              title="No clients yet"
              body="Launch needs a client with an ad account and a landing page. Add one first."
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
        {message && (
          <p
            role="status"
            className={cn(
              "mb-4 rounded-md px-3 py-2 text-[12px]",
              message.tone === "ok"
                ? "border border-success-subtle bg-success-subtle text-success-on-subtle"
                : "border border-danger-border bg-danger-subtle text-danger-on-subtle",
            )}
          >
            {message.text}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="rounded-lg border border-border bg-surface p-5 shadow-raised">
            <h2 className="text-[15px] font-semibold">Set up</h2>
            <p className="mt-0.5 mb-4 text-[13px] text-text-secondary">
              Destination is remembered per client.
            </p>

            <div className="flex flex-col gap-3.5">
              <Select label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>

              <DestinationPicker
                adAccountId={client?.meta_ad_account_id ?? null}
                pageId={client?.meta_page_id ?? null}
                value={destination}
                onChange={setDestination}
              />

              <Select
                label="Ads to generate"
                value={String(count)}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {[6, 10, 12, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </div>

            {creativeCount === 0 && (
              <p className="mt-4 rounded-md border border-warning-subtle bg-warning-subtle px-3 py-2 text-[12px] text-warning-on-subtle">
                ▲ This client has no creatives. Copy will generate, but ads cannot be
                pushed without an image. Add or generate creatives first.
              </p>
            )}

            {!client?.landing_page_url && (
              <p className="mt-3 rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-[12px] text-danger-on-subtle">
                ! This client has no landing page URL. Ads cannot be created without one.
              </p>
            )}

            <Button
              variant="primary"
              className="mt-5 w-full"
              disabled={busy !== null || !client}
              onClick={generate}
            >
              {busy === "generate" ? "Generating copy…" : `Generate ${count} ads`}
            </Button>

            <Button
              className="mt-2 w-full"
              disabled={busy !== null || !client}
              onClick={() => setImporting(true)}
            >
              Import copy from a spreadsheet
            </Button>
          </aside>

          <section>
            {stage === "setup" && variations.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface shadow-raised">
                <EmptyState
                  icon="✦"
                  title="Nothing generated yet"
                  body="Pick a destination and hit generate. Copy is written first, paired with this client's creatives, and you review everything before anything reaches Meta."
                />
              </div>
            ) : (
              <ReviewGrid
                variations={variations}
                busy={busy}
                progress={progress}
                canPush={canPush}
                pushedCount={pushed.length}
                onPush={(ids) => runJob("push", ids)}
                onReject={(ids) => runJob("reject", ids)}
                onRefresh={refresh}
              />
            )}
          </section>
        </div>
      </div>

      {importing && client && (
        <ImportDialog
          clientId={client.id}
          clientName={client.name}
          onClose={() => setImporting(false)}
          onImported={async (n) => {
            setMessage({ tone: "ok", text: `Imported ${n} ad${n === 1 ? "" : "s"} as drafts.` });
            await refresh();
            setStage("review");
          }}
        />
      )}
    </>
  );
}

function Header() {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-surface px-8">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Launch</h1>
      <Badge tone="accent">Ads are always created paused</Badge>
    </header>
  );
}
