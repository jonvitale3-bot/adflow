"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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
  const [instagram, setInstagram] = useState<Array<{ id: string; username?: string }>>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

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
      .then((b) => setInstagram(b.accounts ?? []))
      .catch(() => setInstagram([]));
  }, [adAccountId, pageId, business]);

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

      {campaigns.length > 8 && (
        <div>
          <label className="mb-1.5 block text-[12px] font-[550] text-text-secondary" htmlFor="campaign-filter">
            Find a campaign
          </label>
          <input
            id="campaign-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Try "${clientName.split(/\s+[-–—]\s+/)[0]}"`}
            className="h-[34px] w-full rounded-md border border-border-strong bg-surface px-2.5 text-[13px] outline-none placeholder:text-text-tertiary focus:border-accent focus:focus-ring"
          />
          <p className="mt-1.5 text-[12px] text-text-tertiary">
            This ad account holds {campaigns.length} campaigns, and may serve several
            clients. Campaign names usually carry the client name.
          </p>
        </div>
      )}

      <Select
        label="Campaign"
        value={value.campaignId}
        disabled={loading === "campaigns"}
        hint={loading === "campaigns" ? "Loading campaigns…" : undefined}
        onChange={(e) => onChange({ ...value, campaignId: e.target.value, adSetId: "" })}
      >
        <option value="">
          {loading === "campaigns" ? "Loading…" : "Choose a campaign…"}
        </option>
        {campaigns
          .filter((c) => !filter.trim() || c.name.toLowerCase().includes(filter.trim().toLowerCase()))
          .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.status && c.status !== "ACTIVE" ? ` · ${c.status.toLowerCase()}` : ""}
            </option>
          ))}
      </Select>

      <Select
        label="Ad set"
        value={value.adSetId}
        disabled={!value.campaignId || loading === "adsets"}
        hint={loading === "adsets" ? "Loading ad sets…" : "Ads are created here, paused."}
        onChange={(e) => onChange({ ...value, adSetId: e.target.value })}
      >
        <option value="">
          {loading === "adsets" ? "Loading…" : "Choose an ad set…"}
        </option>
        {adSets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.status && a.status !== "ACTIVE" ? ` · ${a.status.toLowerCase()}` : ""}
          </option>
        ))}
      </Select>

      <Select
        label="Instagram account"
        value={value.instagramId}
        hint="Optional. Ads still run on Facebook without one."
        onChange={(e) => onChange({ ...value, instagramId: e.target.value })}
      >
        {/* Empty string, not the string "none" — the old build sent the literal
            word to Meta, which rejected it. */}
        <option value="">Facebook only</option>
        {instagram.map((ig) => (
          <option key={ig.id} value={ig.id}>{ig.username ? `@${ig.username}` : ig.id}</option>
        ))}
      </Select>
    </div>
  );
}
