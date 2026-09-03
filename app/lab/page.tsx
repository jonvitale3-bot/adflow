"use client";

import { useState } from "react";

/**
 * TEMPORARY. A bench for comparing ported prompt output against the Lovable
 * build before the real Launch flow exists. Intentionally plain — it is not
 * part of the redesign and should be deleted once Launch ships.
 */

interface Warning {
  rule: string;
  detail: string;
}

interface Variation {
  headline: string;
  primary_text: string;
  angle: string;
  warnings: Warning[];
}

interface Result {
  variations: Variation[];
  systemPrompt: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

const INDUSTRIES = [
  "boat_club", "marina", "med_spa", "fitness", "real_estate",
  "home_services", "finance", "insurance", "legal", "automotive",
  "hospitality", "other",
];

const field =
  "mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const label = "mt-4 block text-xs font-medium uppercase tracking-wide text-muted";

export default function LabPage() {
  const [form, setForm] = useState({
    clientName: "Carefree Boat Club - South Florida",
    locationDescription: "South Florida — Biscayne Bay, Key Biscayne, Miami",
    industry: "boat_club",
    seasonType: "year_round",
    currentPromotion: "",
    businessTypeDescription: "",
    offerDescription: "",
    toneKeywords: "",
    brandVoice: "",
    count: 6,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function generate() {
    setPending(true);
    setError(null);
    setResult(null);
    const started = Date.now();

    try {
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, count: Number(form.count) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setResult({ ...data, elapsed: Date.now() - started } as Result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  const isBoatClub = form.industry === "boat_club";

  return (
    <main className="mx-auto grid max-w-7xl gap-8 p-8 lg:grid-cols-[360px_1fr]">
      <section>
        <h1 className="text-xl font-semibold">Prompt bench</h1>
        <p className="mt-1 text-sm text-muted">
          Generate copy and compare it against the Lovable build.
        </p>

        <label className={label}>Client name</label>
        <input
          className={field}
          value={form.clientName}
          onChange={(e) => set("clientName", e.target.value)}
        />

        <label className={label}>Location description</label>
        <input
          className={field}
          value={form.locationDescription}
          onChange={(e) => set("locationDescription", e.target.value)}
        />

        <label className={label}>Industry</label>
        <select
          className={field}
          value={form.industry}
          onChange={(e) => set("industry", e.target.value)}
        >
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>

        {isBoatClub ? (
          <>
            <label className={label}>Season type</label>
            <select
              className={field}
              value={form.seasonType}
              onChange={(e) => set("seasonType", e.target.value)}
            >
              <option value="seasonal">seasonal</option>
              <option value="year_round">year_round</option>
            </select>
          </>
        ) : (
          <>
            <label className={label}>What does this business sell?</label>
            <textarea
              className={field}
              rows={2}
              value={form.businessTypeDescription}
              onChange={(e) => set("businessTypeDescription", e.target.value)}
            />
            <label className={label}>Offer / what the ad drives to</label>
            <textarea
              className={field}
              rows={2}
              value={form.offerDescription}
              onChange={(e) => set("offerDescription", e.target.value)}
            />
            <label className={label}>Tone keywords</label>
            <input
              className={field}
              value={form.toneKeywords}
              onChange={(e) => set("toneKeywords", e.target.value)}
            />
          </>
        )}

        <label className={label}>Brand voice (optional)</label>
        <textarea
          className={field}
          rows={3}
          placeholder="Leave blank to use the default voice"
          value={form.brandVoice}
          onChange={(e) => set("brandVoice", e.target.value)}
        />

        <label className={label}>Current promotion (optional)</label>
        <input
          className={field}
          value={form.currentPromotion}
          onChange={(e) => set("currentPromotion", e.target.value)}
        />

        <label className={label}>Variations: {form.count}</label>
        <input
          type="range"
          min={1}
          max={50}
          step={1}
          className="mt-2 w-full"
          value={form.count}
          onChange={(e) => set("count", Number(e.target.value))}
        />

        <button
          onClick={generate}
          disabled={pending}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate"}
        </button>

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-destructive p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </section>

      <section>
        {result && (
          <>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <span>{result.variations.length} variations</span>
              <span>{result.model}</span>
              <span>in {result.usage.inputTokens.toLocaleString()} tok</span>
              <span>out {result.usage.outputTokens.toLocaleString()} tok</span>
              <span>cache read {result.usage.cacheReadTokens.toLocaleString()} tok</span>
              <button
                className="underline"
                onClick={() => setShowPrompt((s) => !s)}
              >
                {showPrompt ? "hide" : "show"} system prompt
              </button>
            </div>

            {showPrompt && (
              <pre className="mt-4 max-h-96 overflow-auto rounded-md border border-border bg-white p-4 text-xs whitespace-pre-wrap">
                {result.systemPrompt}
              </pre>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {result.variations.map((v, i) => (
                <article key={i} className="rounded-card border border-border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold">{v.headline}</h2>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                      {v.angle}
                    </span>
                  </div>
                  <p className="mt-3 text-sm whitespace-pre-line">{v.primary_text}</p>

                  {v.warnings.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3">
                      {v.warnings.map((w, j) => (
                        <li key={j} className="text-xs text-warning">
                          <span className="font-medium">{w.rule}</span> — {w.detail}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
