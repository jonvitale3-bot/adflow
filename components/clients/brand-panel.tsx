"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

interface BrandValues {
  brand_website_url: string;
  brand_voice: string;
  key_phrases: string;
  never_say: string;
  ad_examples: string;
}

const EMPTY: BrandValues = {
  brand_website_url: "",
  brand_voice: "",
  key_phrases: "",
  never_say: "",
  ad_examples: "",
};

/**
 * Per-client brand voice.
 *
 * The Lovable build kept ONE global row applied to every client, so a med spa
 * was prompted with a boat club's voice under a boat club's name
 * (docs/SPEC.md §9 rule 25). These values feed straight into the copy prompt
 * for this client and nobody else.
 */
export function BrandPanel({
  clientId,
  clientName,
  landingPageUrl,
  specialAdCategory,
  onClose,
}: {
  clientId: string;
  clientName: string;
  landingPageUrl: string | null;
  specialAdCategory: string;
  onClose: () => void;
}) {
  const [values, setValues] = useState<BrandValues>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [scraped, setScraped] = useState<Set<keyof BrandValues>>(new Set());

  useEffect(() => {
    void fetch(`/api/clients/${clientId}/brand`)
      .then((r) => r.json())
      .then((b) => {
        if (b.brand) {
          setValues({
            brand_website_url: b.brand.brand_website_url ?? "",
            brand_voice: b.brand.brand_voice ?? "",
            key_phrases: b.brand.key_phrases ?? "",
            never_say: b.brand.never_say ?? "",
            ad_examples: b.brand.ad_examples ?? "",
          });
        } else if (landingPageUrl) {
          // Seed from the landing page so there is usually nothing to type.
          try {
            setValues({ ...EMPTY, brand_website_url: new URL(
              landingPageUrl.startsWith("http") ? landingPageUrl : `https://${landingPageUrl}`,
            ).origin });
          } catch {
            /* leave blank */
          }
        }
      })
      .finally(() => setLoading(false));
  }, [clientId, landingPageUrl]);

  function set(key: keyof BrandValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setScraped((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function scrape() {
    setScraping(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/brand`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: values.brand_website_url }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ tone: "error", text: body.error ?? "Could not analyse that site" });
        return;
      }
      setValues((v) => ({
        ...v,
        brand_voice: body.brand.brand_voice ?? v.brand_voice,
        key_phrases: body.brand.key_phrases ?? v.key_phrases,
        never_say: body.brand.never_say ?? v.never_say,
      }));
      setScraped(new Set(["brand_voice", "key_phrases", "never_say"]));
      setMessage({
        tone: "ok",
        text: "Read the site. Review these before saving — they shape every ad for this client.",
      });
    } finally {
      setScraping(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/brand`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ tone: "error", text: body.error ?? "Could not save" });
        return;
      }
      setScraped(new Set());
      setMessage({ tone: "ok", text: "Saved." });
    } finally {
      setSaving(false);
    }
  }

  const regulated = specialAdCategory !== "none";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[rgb(23_23_26_/_0.28)]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Brand voice"
        className="relative flex h-full w-[460px] flex-col rounded-l-xl bg-surface shadow-[var(--shadow-panel)]"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold">Brand voice</h2>
            <p className="mt-0.5 text-[13px] text-text-secondary">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-text-tertiary hover:bg-surface-muted hover:text-text-primary"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {message && (
            <p
              role="status"
              className={cn(
                "mb-4 rounded-md px-3 py-2 text-[12px] leading-[1.45]",
                message.tone === "ok"
                  ? "border border-success-subtle bg-success-subtle text-success-on-subtle"
                  : "border border-danger-border bg-danger-subtle text-danger-on-subtle",
              )}
            >
              {message.text}
            </p>
          )}

          {loading ? (
            <p className="text-[13px] text-text-secondary">Loading…</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              <div className="rounded-lg border border-accent-subtle-border bg-accent-subtle p-3">
                <p className="text-[12px] leading-[1.45] text-text-secondary">
                  Read this client&rsquo;s own website and infer how they sound. Applies to
                  this client only.
                </p>
                <div className="mt-2.5 flex items-end gap-2">
                  <Input
                    label="Website"
                    placeholder="example.com"
                    className="bg-surface"
                    value={values.brand_website_url}
                    onChange={(e) => set("brand_website_url", e.target.value)}
                  />
                  <Button
                    variant="primary"
                    className="mb-0 shrink-0"
                    disabled={scraping || !values.brand_website_url.trim()}
                    onClick={scrape}
                  >
                    {scraping ? <Spinner /> : "Read site"}
                  </Button>
                </div>
                {scraping && (
                  <p className="mt-2 text-[12px] text-text-tertiary">
                    Reading the homepage and the pages that carry the most voice. Around
                    20–40 seconds.
                  </p>
                )}
              </div>

              {regulated && (
                <p className="rounded-md border border-warning-subtle bg-warning-subtle px-3 py-2 text-[12px] leading-[1.45] text-warning-on-subtle">
                  ▲ This client is in a Meta special ad category. Compliance rules for that
                  category are folded into &ldquo;Never say&rdquo; automatically when the
                  site is read.
                </p>
              )}

              <Textarea
                label="Brand voice"
                rows={5}
                aiFilled={scraped.has("brand_voice")}
                hint="How they sound. Feeds the copy prompt for this client."
                value={values.brand_voice}
                onChange={(e) => set("brand_voice", e.target.value)}
              />

              <Textarea
                label="Key phrases"
                rows={3}
                aiFilled={scraped.has("key_phrases")}
                hint="Phrases they actually use, one per line."
                value={values.key_phrases}
                onChange={(e) => set("key_phrases", e.target.value)}
              />

              <Textarea
                label="Never say"
                rows={4}
                aiFilled={scraped.has("never_say")}
                hint="Words, claims and framings to avoid. Enforced in every generation."
                value={values.never_say}
                onChange={(e) => set("never_say", e.target.value)}
              />

              <Textarea
                label="Example ads"
                rows={4}
                hint="Ads that represent the ideal style. The model writes in this voice."
                value={values.ad_examples}
                onChange={(e) => set("ad_examples", e.target.value)}
              />
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-6 py-3.5">
          <span className="text-[12px] text-text-tertiary">
            {scraped.size > 0 ? "Tinted fields came from the site" : ""}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving || loading}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
