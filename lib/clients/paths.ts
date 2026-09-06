/**
 * Where a client's work lives.
 *
 * The client is the container. Creatives and Launch are steps inside one
 * client, not screens with a client dropdown on top, so their URLs carry the
 * client and the sidebar follows it. The plain /creatives and /launch URLs
 * still exist and open the client last worked on.
 */

export type Section = "creatives" | "launch";

export const SECTIONS: Section[] = ["creatives", "launch"];

/** Remembered by the middleware so /creatives and /launch know where to go. */
export const LAST_CLIENT_COOKIE = "adflow_client";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CLIENT_PATH = new RegExp(`^/clients/(${UUID})(?:/|$)`, "i");

export function clientPath(id: string, section: Section): string {
  return `/clients/${id}/${section}`;
}

/** The client a path is inside, or null for the list, settings and the rest. */
export function clientIdFromPath(pathname: string): string | null {
  return CLIENT_PATH.exec(pathname)?.[1] ?? null;
}

/** Which step a path is on, when it is inside a client. */
export function sectionFromPath(pathname: string): Section | null {
  const id = clientIdFromPath(pathname);
  if (!id) return null;
  const rest = pathname.slice(`/clients/${id}`.length);
  return SECTIONS.find((s) => rest === `/${s}` || rest.startsWith(`/${s}/`)) ?? null;
}

export function isUuid(value: string | undefined | null): value is string {
  return !!value && new RegExp(`^${UUID}$`, "i").test(value);
}
