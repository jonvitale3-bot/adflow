"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { industryLabel } from "@/lib/clients/grouping";
import {
  ClientFormSchema,
  INDUSTRIES,
  MARINE_BUSINESS_TYPES,
  MARINE_TYPE_LABELS,
  SPECIAL_AD_CATEGORIES,
  SPECIAL_AD_CATEGORY_LABELS,
  fieldErrors,
  suggestedAdCategory,
  type ClientFormValues,
} from "@/lib/clients/validation";

const EMPTY: ClientFormValues = {
  name: "",
  industry: "boat_club",
  marine_business_type: "",
  special_ad_category: "none",
  meta_business: "",
  location_description: "",
  meta_page_id: "",
  meta_ad_account_id: "",
  meta_pixel_id: "",
  landing_page_url: "",
  season_type: "seasonal",
  market_name: "",
  boating_style: "",
  environment_style: "",
  business_type_description: "",
  offer_description: "",
  tone_keywords: "",
  current_promotion: "",
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 mb-2.5 text-[11px] font-semibold tracking-[0.05em] text-text-tertiary uppercase first:mt-0">
      {children}
    </h3>
  );
}

export function ClientPanel({
  open,
  initial,
  title,
  subtitle,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial?: Partial<ClientFormValues> & { id?: string };
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<ClientFormValues>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [autofilling, setAutofilling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [businesses, setBusinesses] = useState<Array<{ key: string; label: string }>>([]);

  useEffect(() => {
    setValues({ ...EMPTY, ...initial });
    setErrors({});
    setAiFields(new Set());
    setFormError(null);
  }, [initial, open]);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/settings/businesses")
      .then((r) => r.json())
      .then((b) => setBusinesses(b.businesses ?? []))
      .catch(() => setBusinesses([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function set<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      // Changing industry re-suggests the Meta special ad category, but only
      // while the operator has not chosen one themselves.
      if (key === "industry" && v.special_ad_category === suggestedAdCategory(String(v.industry))) {
        next.special_ad_category = suggestedAdCategory(String(value)) as ClientFormValues["special_ad_category"];
      }
      return next;
    });
    // The AI tint clears on any user edit, so a field always shows whether its
    // current value was generated or typed.
    setAiFields((prev) => {
      if (!prev.has(String(key))) return prev;
      const next = new Set(prev);
      next.delete(String(key));
      return next;
    });
    setErrors((e) => {
      if (!e[String(key)]) return e;
      const { [String(key)]: _, ...rest } = e;
      return rest;
    });
  }

  async function autofill() {
    if (!values.name.trim()) {
      setErrors((e) => ({ ...e, name: "Add a client name first" }));
      return;
    }
    setAutofilling(true);
    setFormError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/clients/autofill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          locationDescription: values.location_description,
          industry: values.industry,
          marineBusinessType: values.marine_business_type || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setFormError(body.error ?? "Auto-fill failed");
        return;
      }

      // Only fill what is empty — never overwrite something already typed.
      const filled = new Set<string>();
      setValues((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(body.values as Record<string, string>)) {
          if (!value) continue;
          const k = key as keyof ClientFormValues;
          if (String(current[k] ?? "").trim() === "") {
            (next[k] as unknown) = value;
            filled.add(key);
          }
        }
        return next;
      });
      setAiFields(filled);
      setNotice(
        body.warning ??
          (filled.size > 0
            ? `Filled ${filled.size} empty field${filled.size === 1 ? "" : "s"}. Check them before saving.`
            : "Nothing to fill — every field already has a value."),
      );
    } finally {
      setAutofilling(false);
    }
  }

  async function save() {
    const parsed = ClientFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      // Move focus to the first field that needs attention.
      panelRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(initial?.id ? `/api/clients/${initial.id}` : "/api/clients", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok) {
        setFormError(body.error ?? "Could not save this client.");
        if (body.fieldErrors) setErrors(body.fieldErrors);
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save this client.");
    } finally {
      setSaving(false);
    }
  }

  const isBoatClub = values.industry === "boat_club";
  const isMarina = values.industry === "marina";
  const errorCount = Object.keys(errors).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-[rgb(23_23_26_/_0.28)]"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-[460px] flex-col rounded-l-xl bg-surface shadow-[var(--shadow-panel)]"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-text-secondary">{subtitle}</p>}
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
          {formError && (
            <p
              role="alert"
              className="mb-4 flex gap-1.5 rounded-md border border-danger-border bg-danger-subtle px-2.5 py-2 text-[12px] leading-[1.45] text-danger-on-subtle"
            >
              <span aria-hidden className="font-bold">!</span>
              {formError}
            </p>
          )}

          {notice && (
            <p
              role="status"
              className="mb-4 rounded-md border border-accent-subtle-border bg-accent-subtle px-3 py-2 text-[12px] leading-[1.45] text-text-secondary"
            >
              {notice}
            </p>
          )}

          <div className="mb-5 flex items-center gap-3 rounded-lg border border-accent-subtle-border bg-accent-subtle p-3">
            <p className="min-w-0 flex-1 text-[12px] leading-[1.45] text-text-secondary">
              {autofilling
                ? "Reading the business name and location — filling market, environment and voice fields."
                : "Fill market, environment and voice fields from the client's name and location."}
            </p>
            {autofilling ? (
              <Spinner />
            ) : (
              <Button variant="primary" className="shrink-0" onClick={autofill}>
                Auto-fill with AI
              </Button>
            )}
          </div>

          <SectionHeading>Classification</SectionHeading>
          <div className="flex flex-col gap-3.5">
            <Select
              label="Industry"
              value={values.industry}
              onChange={(e) => set("industry", e.target.value as ClientFormValues["industry"])}
            >
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{industryLabel(i)}</option>
              ))}
            </Select>

            {isMarina && (
              <Select
                label="Marina business type"
                required
                error={errors.marine_business_type}
                hint="Selects the prompt and scene bank. Without it a marina falls back to the generic prompt."
                value={values.marine_business_type ?? ""}
                onChange={(e) =>
                  set("marine_business_type", e.target.value as ClientFormValues["marine_business_type"])
                }
              >
                <option value="">Choose a type…</option>
                {MARINE_BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>{MARINE_TYPE_LABELS[t]}</option>
                ))}
              </Select>
            )}

            <Select
              label="Meta special ad category"
              hint="Restricts targeting and constrains copy. Finance and insurance are usually Credit; real estate is Housing."
              value={values.special_ad_category}
              onChange={(e) =>
                set("special_ad_category", e.target.value as ClientFormValues["special_ad_category"])
              }
            >
              {SPECIAL_AD_CATEGORIES.map((c) => (
                <option key={c} value={c}>{SPECIAL_AD_CATEGORY_LABELS[c]}</option>
              ))}
            </Select>
          </div>

          <SectionHeading>Identity</SectionHeading>
          <div className="flex flex-col gap-3.5">
            <Input
              label="Client name"
              required
              error={errors.name}
              hint='Use "Brand — Location" to group locations under one brand.'
              value={values.name}
              aiFilled={aiFields.has("name")}
              onChange={(e) => set("name", e.target.value)}
            />
            <Input
              label="Location description"
              value={values.location_description}
              aiFilled={aiFields.has("location_description")}
              onChange={(e) => set("location_description", e.target.value)}
            />
          </div>

          <SectionHeading>Meta connection</SectionHeading>
          {businesses.length > 1 && (
            <div className="mb-3.5">
              <Select
                label="Business portfolio"
                hint="Which Business Manager this client's ad account lives in. One token cannot see across portfolios."
                value={values.meta_business ?? ""}
                onChange={(e) => set("meta_business", e.target.value)}
              >
                {businesses.map((b) => (
                  <option key={b.key} value={b.key === "default" ? "" : b.key}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3.5">
            <Input
              label="Facebook Page ID"
              mono
              error={errors.meta_page_id}
              value={values.meta_page_id}
              aiFilled={aiFields.has("meta_page_id")}
              onChange={(e) => set("meta_page_id", e.target.value)}
            />
            <Input
              label="Ad Account ID"
              mono
              placeholder="act_449021773"
              error={errors.meta_ad_account_id}
              value={values.meta_ad_account_id}
              aiFilled={aiFields.has("meta_ad_account_id")}
              onChange={(e) => set("meta_ad_account_id", e.target.value)}
            />
          </div>
          <div className="mt-3.5 flex flex-col gap-3.5">
            <Input
              label="Landing page URL"
              error={errors.landing_page_url}
              value={values.landing_page_url}
              aiFilled={aiFields.has("landing_page_url")}
              onChange={(e) => set("landing_page_url", e.target.value)}
            />
            <Input
              label="Facebook Pixel ID"
              mono
              error={errors.meta_pixel_id}
              value={values.meta_pixel_id}
              aiFilled={aiFields.has("meta_pixel_id")}
              onChange={(e) => set("meta_pixel_id", e.target.value)}
            />
          </div>

          <SectionHeading>Voice</SectionHeading>
          <div className="flex flex-col gap-3.5">
            {isBoatClub ? (
              <>
                <Select
                  label="Season type"
                  hint="Year-round markets ban seasonal urgency framing entirely."
                  value={values.season_type}
                  onChange={(e) =>
                    set("season_type", e.target.value as ClientFormValues["season_type"])
                  }
                >
                  <option value="seasonal">Seasonal</option>
                  <option value="year_round">Year-round</option>
                </Select>
                <Input
                  label="Market name"
                  value={values.market_name}
                  aiFilled={aiFields.has("market_name")}
                  onChange={(e) => set("market_name", e.target.value)}
                />
                <Input
                  label="Boating style"
                  value={values.boating_style}
                  aiFilled={aiFields.has("boating_style")}
                  onChange={(e) => set("boating_style", e.target.value)}
                />
                <Input
                  label="Environment style"
                  value={values.environment_style}
                  aiFilled={aiFields.has("environment_style")}
                  onChange={(e) => set("environment_style", e.target.value)}
                />
              </>
            ) : (
              <>
                <Textarea
                  label="What does this business sell?"
                  value={values.business_type_description}
                  aiFilled={aiFields.has("business_type_description")}
                  onChange={(e) => set("business_type_description", e.target.value)}
                />
                <Textarea
                  label="Offer / what the ad drives to"
                  value={values.offer_description}
                  aiFilled={aiFields.has("offer_description")}
                  onChange={(e) => set("offer_description", e.target.value)}
                />
                <Input
                  label="Tone keywords"
                  value={values.tone_keywords}
                  aiFilled={aiFields.has("tone_keywords")}
                  onChange={(e) => set("tone_keywords", e.target.value)}
                />
              </>
            )}
            <Input
              label="Current promotion"
              hint="Woven into roughly a third of generated variations."
              value={values.current_promotion}
              onChange={(e) => set("current_promotion", e.target.value)}
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-6 py-3.5">
          <span className={cn("text-[12px]", errorCount > 0 ? "text-danger-on-subtle" : "text-text-tertiary")}>
            {errorCount > 0
              ? `${errorCount} field${errorCount === 1 ? "" : "s"} need${errorCount === 1 ? "s" : ""} attention`
              : ""}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save client"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
