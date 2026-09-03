import { SCENE_BANK, bankFor } from "./scenes.ts";

/** Human labels for scene ids, so the picker does not show snake_case. */
export const SCENE_LABELS: Record<string, string> = {
  fun: "Fun / jumping in",
  cruising: "Cruising",
  fishing: "Fishing",
  sunset: "Sunset anchored",
  family: "Family day",
  sandbar: "Sandbar raft-up",
  watersports: "Watersports",
  arrival: "Arrival at the dock",
  family_day: "Family day out",
  sunset_cruise: "Sunset cruise",
  dock_lineup: "Fleet line-up",
  aerial: "Aerial marina",
  dock_walk: "Dock walk",
  sunset_slip: "Sunset in the slip",
  protected_harbor: "Protected harbour",
  rack_hero: "Dry stack interior",
  forklift_launch: "Forklift launch",
  yard_aerial: "Storage yard aerial",
  ready_to_launch: "Ready to launch",
  marina_aerial: "Marina aerial",
  slip_lifestyle: "Slip lifestyle",
  rack_to_water: "Rack to water",
  fuel_dock: "Fuel dock",
  service_bay: "Service bay",
  ship_store: "Ship store",
  marina_hero: "Marina hero",
};

export function sceneOptions(industry: string, marineBusinessType?: string | null) {
  const bank = bankFor(industry, marineBusinessType);
  if (!bank) return [];
  return Object.keys(bank).map((id) => ({ id, label: SCENE_LABELS[id] ?? id }));
}

export { SCENE_BANK };
