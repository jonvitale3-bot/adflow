import { z } from "zod";

/**
 * Client form validation. Mirrors the database constraints so a mistake is
 * caught at the field rather than surfacing later as a Meta API error — which
 * is how the Lovable build handled it (docs/SPEC.md §3).
 */

export const INDUSTRIES = [
  "boat_club", "marina", "med_spa", "fitness", "real_estate", "home_services",
  "finance", "insurance", "legal", "automotive", "hospitality", "other",
] as const;

export const MARINE_BUSINESS_TYPES = [
  "boat_rentals", "wet_slips", "dry_storage", "storage_slips", "full_service",
] as const;

export const SPECIAL_AD_CATEGORIES = [
  "none", "credit", "employment", "housing", "social_issues",
] as const;

export const MARINE_TYPE_LABELS: Record<string, string> = {
  boat_rentals: "Boat Rentals",
  wet_slips: "Wet Slips",
  dry_storage: "Dry Storage",
  storage_slips: "Storage & Slips",
  full_service: "Full Service",
};

export const SPECIAL_AD_CATEGORY_LABELS: Record<string, string> = {
  none: "None",
  credit: "Credit (finance, lending, insurance)",
  employment: "Employment",
  housing: "Housing (real estate, mortgages)",
  social_issues: "Social issues, elections or politics",
};

/** Meta rejects a bare account id; the act_ prefix is required. */
const adAccountId = z
  .string()
  .trim()
  .refine((v) => v === "" || /^act_\d+$/.test(v), {
    message: "Must start with act_ followed by digits, e.g. act_449021773",
  });

const numericId = (field: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), { message: `${field} is digits only` });

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (v) => {
      if (v === "") return true;
      try {
        // Accept a bare domain; the operator rarely types the scheme.
        new URL(v.startsWith("http") ? v : `https://${v}`);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Must be a valid URL" },
  );

export const ClientFormSchema = z
  .object({
    name: z.string().trim().min(1, "Client name is required"),
    industry: z.enum(INDUSTRIES),
    marine_business_types: z.array(z.enum(MARINE_BUSINESS_TYPES)).default([]),
    special_ad_category: z.enum(SPECIAL_AD_CATEGORIES).default("none"),
    meta_business: z.string().trim().default(""),
    location_description: z.string().trim().default(""),
    meta_page_id: numericId("Facebook Page ID").default(""),
    meta_ad_account_id: adAccountId.default(""),
    meta_pixel_id: numericId("Pixel ID").default(""),
    landing_page_url: optionalUrl.default(""),
    season_type: z.enum(["seasonal", "year_round"]).default("seasonal"),
    market_name: z.string().trim().default(""),
    boating_style: z.string().trim().default(""),
    environment_style: z.string().trim().default(""),
    business_type_description: z.string().trim().default(""),
    offer_description: z.string().trim().default(""),
    tone_keywords: z.string().trim().default(""),
    current_promotion: z.string().trim().default(""),
  })
  // A marina with no service falls through to the generic prompt and quietly
  // produces worse creative, so the database rejects it and so does the form.
  .refine((v) => v.industry !== "marina" || v.marine_business_types.length > 0, {
    message: "Pick at least one service — they select the prompt and the scenes",
    path: ["marine_business_types"],
  });

export type ClientFormValues = z.input<typeof ClientFormSchema>;

/**
 * Finance, insurance and real estate almost always fall into a Meta special ad
 * category, which restricts targeting and constrains copy. Suggested, never
 * forced — the operator knows the account.
 */
export function suggestedAdCategory(industry: string): string {
  if (industry === "finance" || industry === "insurance") return "credit";
  if (industry === "real_estate") return "housing";
  return "none";
}

export function fieldErrors(result: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of result.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
