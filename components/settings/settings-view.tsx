"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface BusinessResult {
  key: string;
  label: string;
  envName: string;
  ok: boolean;
  error?: string;
  adAccounts?: Array<{ id: string; name: string; business: string | null; active: boolean }>;
  pageCount?: number;
}

interface MetaCheck {
  ok: boolean;
  error?: string;
  businesses?: BusinessResult[];
}

const CREDENTIALS = [
  {
    key: "meta" as const,
    name: "META_ACCESS_TOKEN",
    label: "Meta Marketing API",
    detail: "One Business Manager system-user token with access to every client ad account.",
    needed: "Required to create ads.",
  },
  {
    key: "anthropic" as const,
    name: "ANTHROPIC_API_KEY",
    label: "Anthropic",
    detail: "Ad copy, brand voice inference and client auto-fill.",
    needed: "Required to generate copy.",
  },
  {
    key: "openai" as const,
    name: "OPENAI_API_KEY",
    label: "OpenAI",
    detail: "Image generation.",
    needed: "Required to generate images.",
  },
];

export function SettingsView({
  email,
  configured,
  graphVersion,
  counts,
}: {
  email: string;
  configured: Record<"meta" | "anthropic" | "openai", boolean>;
  graphVersion: string;
  counts: { clients: number; creatives: number; variations: number };
}) {
  const [check, setCheck] = useState<MetaCheck | null>(null);
  const [testing, setTesting] = useState(false);

  async function testMeta() {
    setTesting(true);
    setCheck(null);
    try {
      const res = await fetch("/api/settings/test-meta");
      setCheck(await res.json());
    } catch (err) {
      setCheck({ ok: false, error: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <header className="flex h-[52px] shrink-0 items-center border-b border-border bg-surface px-8">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Settings</h1>
      </header>

      <div className="mx-auto w-full max-w-[820px] p-6">
        <section className="rounded-lg border border-border bg-surface p-5 shadow-raised">
          <h2 className="text-[15px] font-semibold">Credentials</h2>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-text-secondary">
            Credentials live in Vercel environment variables and are readable only by the
            server. They are deliberately not editable here, and their values are never
            sent to the browser — this page can only report whether each one is set.
          </p>

          <ul className="mt-4 divide-y divide-border">
            {CREDENTIALS.map((cred) => (
              <li key={cred.key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-[550]">{cred.label}</span>
                    <code className="font-mono text-[11px] text-text-tertiary">{cred.name}</code>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-[1.45] text-text-secondary">
                    {cred.detail} {cred.needed}
                  </p>
                </div>
                {configured[cred.key] ? (
                  <Badge tone="success" glyph="●">Set</Badge>
                ) : (
                  <Badge tone="warning" glyph="▲">
                    Not set
                  </Badge>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-[12px] leading-[1.45] text-text-secondary">
            To change one: Vercel → Project → Settings → Environment Variables, then
            redeploy. Vercel does not pick up a new value until the next deploy.
          </p>

          <p className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-[12px] leading-[1.45] text-text-secondary">
            <strong className="font-[550]">A second Meta business portfolio</strong> needs its
            own system-user token — one token cannot see across Business Managers. Add it as{" "}
            <code className="font-mono text-[11px]">META_ACCESS_TOKEN_&lt;NAME&gt;</code> (for
            example <code className="font-mono text-[11px]">META_ACCESS_TOKEN_ENGAGE</code>),
            redeploy, then set each client&rsquo;s portfolio on its record. No code change needed.
          </p>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-raised">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold">Meta connection</h2>
              <p className="mt-0.5 text-[13px] text-text-secondary">
                Check what each business portfolio&rsquo;s token can see. Graph {graphVersion}.
              </p>
            </div>
            <Button onClick={testMeta} disabled={testing || !configured.meta}>
              {testing ? "Checking…" : "Test connection"}
            </Button>
          </div>

          {check && !check.ok && (
            <p className="mt-4 rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-[12px] leading-[1.45] text-danger-on-subtle">
              ! {check.error}
            </p>
          )}

          {check?.businesses?.map((b) => (
            <div key={b.key} className="mt-4">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-[550]">{b.label}</span>
                <code className="font-mono text-[11px] text-text-tertiary">{b.envName}</code>
              </div>

              {b.ok ? (
                <>
                  <p className="mt-1 text-[12px] text-success-on-subtle">
                    ● {b.adAccounts?.length ?? 0} ad accounts, {b.pageCount ?? 0} Pages visible.
                  </p>
                  {b.adAccounts && b.adAccounts.length > 0 && (
                    <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
                      {b.adAccounts.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px]">{a.name}</p>
                            <p className="font-mono text-[11px] text-text-tertiary">
                              {a.id}
                              {a.business ? ` · ${a.business}` : ""}
                            </p>
                          </div>
                          {!a.active && <Badge tone="warning" glyph="▲">Inactive</Badge>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="mt-1 rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-[12px] leading-[1.45] text-danger-on-subtle">
                  ! {b.error}
                </p>
              )}
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-raised">
          <h2 className="text-[15px] font-semibold">This workspace</h2>
          <dl className="mt-3 grid grid-cols-3 gap-4">
            {[
              ["Clients", counts.clients],
              ["Creatives", counts.creatives],
              ["Ad variations", counts.variations],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border border-border px-3 py-2.5">
                <dt className="text-[11px] font-semibold tracking-[0.04em] text-text-tertiary uppercase">
                  {label}
                </dt>
                <dd className="tabular mt-0.5 text-[20px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className={cn("mt-4 text-[12px] text-text-secondary")}>
            Signed in as {email}. Accounts are created by hand in Supabase; there is no
            sign-up.
          </p>
        </section>
      </div>
    </>
  );
}
