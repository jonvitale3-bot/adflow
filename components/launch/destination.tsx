"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/field";

interface Option {
  id: string;
  name: string;
  status?: string;
}

export interface Destination {
  campaignId: string;
  adSetId: string;
  instagramId: string;
}

/**
 * Campaign, ad set and Instagram identity, remembered per client.
 *
 * The old build made you click "Load Campaigns" and re-pick the same ad set on
 * every launch. Here the saved destination loads with the client and the
 * lookups run on their own.
 */
export function DestinationPicker({
  adAccountId,
  pageId,
  business,
  clientName,
  value,
  onChange,
}: {
  adAccountId: string | null;
  pageId: string | null;
  business: string | null;
  clientName: string;
  value: Destination;
  onChange: (next: Destination) => void;
}) {
  const [campaigns, setCampaigns] = useState<Option[]>([]);
  const [adSets, setAdSets] = useState<Option[]>([]);
  const [instagram, setInstagram] = useState<
    Array<{ id: string; username?: string; pageBacked?: boolean }>
  >([]);
  const [igAttempts, setIgAttempts] = useState<
    Array<{ source: string; ok: boolean; found: number; error?: string }>
  >([]);
  const [igNote, setIgNote] = useState<string | null>(null);
  const [creatingIg, setCreatingIg] = useState(false);
  const [manualIg, setManualIg] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    if (!adAccountId) return;
    setLoading("campaigns");
    setError(null);
    try {
      const params = new URLSearchParams({ adAccountId });
      if (business) params.set("business", business);
      const res = await fetch(`/api/meta/campaigns?${params}`);
      const body = await res.json();
      if (!res.ok) setError(body.error);
      else setCampaigns(body.campaigns);
    } finally {
      setLoading(null);
    }
  }, [adAccountId, business]);

  useEffect(() => {
    setCampaigns([]);
    setAdSets([]);
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!adAccountId) return;
    const params = new URLSearchParams({ adAccountId });
    if (pageId) params.set("pageId", pageId);
    if (business) params.set("business", business);
    void fetch(`/api/meta/instagram?${params}`)
      .then((r) => r.json())
      .then((b) => {
        setInstagram(b.accounts ?? []);
        setIgAttempts(b.attempts ?? []);
      })
      .catch(() => {
        setInstagram([]);
        setIgAttempts([]);
      });
  }, [adAccountId, pageId, business]);

  /**
   * Asks Meta for a Page-backed Instagram account.
   *
   * Meta creates one by itself the first time an ad needs an Instagram
   * identity, but a creative cannot claim an Instagram placement before it
   * exists. Behind a button because it writes to the client's Page.
   */
  async function createPageBackedIg() {
    if (!pageId) return;
    setCreatingIg(true);
    setIgNote(null);
    try {
      const res = await fetch("/api/meta/instagram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId, business }),
      });
      const body = await res.json();
      if (!res.ok) {
        setIgNote(body.error ?? "Could not create the account");
        return;
      }
      setInstagram((prev) => [...prev, { ...body.account, pageBacked: true }]);
      onChange({ ...value, instagramId: body.account.id });
      setIgNote("Created. Instagram placements can be used now.");
    } finally {
      setCreatingIg(false);
    }
  }

  const loadAdSets = useCallback(
    async (campaignId: string) => {
      if (!campaignId) {
        setAdSets([]);
        return;
      }
      setLoading("adsets");
      setError(null);
      try {
        const params = new URLSearchParams({ campaignId });
      if (business) params.set("business", business);
      const res = await fetch(`/api/meta/adsets?${params}`);
        const body = await res.json();
        if (!res.ok) setError(body.error);
        else setAdSets(body.adSets);
      } finally {
        setLoading(null);
      }
    },
    [business],
  );

  useEffect(() => {
    if (value.campaignId) void loadAdSets(value.campaignId);
  }, [value.campaignId, loadAdSets]);

  if (!adAccountId) {
    return (
      <p className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-[12px] text-danger-on-subtle">
        This client has no ad account id, so ads cannot be created. Add one on the client first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning-subtle bg-warning-subtle px-3 py-2">
          <p className="text-[12px] text-warning-on-subtle">{error}</p>
          <Button size="row" onClick={loadCampaigns}>Retry</Button>
        </div>
      )}

      <Combobox
        label="Campaign"
        value={value.campaignId}
        loading={loading === "campaigns"}
        options={campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          note: c.status && c.status !== "ACTIVE" ? c.status.toLowerCase() : undefined,
          deemphasised: Boolean(c.status && c.status !== "ACTIVE"),
        }))}
        // One ad account can serve several clients, and campaign names carry
        // the client name, so the search opens already narrowed to this one.
        suggestedQuery={clientName.split(/\s+[-–—]\s+/)[0]}
        placeholder={campaigns.length ? "Choose a campaign…" : "No campaigns found"}
        hint={
          campaigns.length > 12
            ? `${campaigns.length} campaigns in this ad account — type to filter.`
            : undefined
        }
        emptyMessage="No campaign matches that search"
        onChange={(id) => onChange({ ...value, campaignId: id, adSetId: "" })}
      />

      <Combobox
        label="Ad set"
        value={value.adSetId}
        disabled={!value.campaignId}
        loading={loading === "adsets"}
        options={adSets.map((a) => ({
          id: a.id,
          name: a.name,
          note: a.status && a.status !== "ACTIVE" ? a.status.toLowerCase() : undefined,
          deemphasised: Boolean(a.status && a.status !== "ACTIVE"),
        }))}
        placeholder={
          !value.campaignId
            ? "Choose a campaign first"
            : adSets.length
              ? "Choose an ad set…"
              : "No ad sets in this campaign"
        }
        hint="Ads are created here, paused."
        emptyMessage="No ad set matches that search"
        onChange={(id) => onChange({ ...value, adSetId: id })}
      />

      <div>
        <Select
          label="Instagram account"
          value={value.instagramId}
          hint={
            value.instagramId
              ? "Ads run on Instagram as this identity."
              : "Optional, but without one the ad cannot run on Instagram at all, so a vertical size will only serve Facebook stories."
          }
          onChange={(e) => onChange({ ...value, instagramId: e.target.value })}
        >
          {/* Empty string, not the string "none" — the old build sent the
              literal word to Meta, which rejected it. */}
          <option value="">Facebook only</option>
          {instagram.map((ig) => (
            <option key={ig.id} value={ig.id}>
              {ig.username ? `@${ig.username}` : ig.id}
              {ig.pageBacked ? " (via the Facebook Page)" : ""}
            </option>
          ))}
        </Select>

        {/* An empty list used to look the same whether the client has no
            Instagram identity or every lookup failed. It says which now. */}
        {instagram.length === 0 && igAttempts.length > 0 && (
          <div className="mt-1.5 rounded-md border border-border bg-surface-muted px-2.5 py-2">
            <p className="text-[12px] text-text-secondary">
              {igAttempts.every((a) => a.ok)
                ? "This Page has no Instagram identity yet. Meta makes one the first time an ad needs it, but a per-placement ad has to name it up front."
                : "Meta could not be asked for this client's Instagram identity."}
            </p>

            <ul className="mt-1.5 space-y-0.5">
              {igAttempts.map((a) => (
                <li key={a.source} className="font-mono text-[11px] text-text-tertiary">
                  {a.ok
                    ? `○ ${a.source}: ${a.found === 0 ? "none" : `${a.found} found`}`
                    : `! ${a.source}: ${a.error}`}
                </li>
              ))}
            </ul>

            {pageId && igAttempts.every((a) => a.ok) && (
              <Button
                size="row"
                className="mt-2"
                disabled={creatingIg}
                onClick={createPageBackedIg}
                title="Creates a Page-backed Instagram account on this client's Facebook Page. It is used only by ads and nobody posts from it."
              >
                {creatingIg ? "Creating…" : "Create one from the Page"}
              </Button>
            )}

            {/* The last resort, and the one that always works: Business
                Settings shows the account's numeric id, and pasting it needs
                no permission this token does not have. */}
            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={manualIg}
                onChange={(e) => setManualIg(e.target.value.trim())}
                placeholder="Or paste an Instagram account ID"
                inputMode="numeric"
                className="h-[26px] min-w-0 flex-1 rounded-[5px] border border-border-strong bg-surface px-2 text-[12px] outline-none placeholder:text-text-tertiary focus:border-accent focus:focus-ring"
              />
              <Button
                size="row"
                disabled={!/^\d{5,}$/.test(manualIg)}
                onClick={() => {
                  setInstagram((prev) => [...prev, { id: manualIg }]);
                  onChange({ ...value, instagramId: manualIg });
                  setManualIg("");
                  setIgNote("Using that account. Instagram placements can be used now.");
                }}
              >
                Use
              </Button>
            </div>

            {igNote && (
              <p className="mt-1.5 text-[12px] text-text-secondary">{igNote}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
