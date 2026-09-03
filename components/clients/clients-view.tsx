"use client";

import { useMemo, useState } from "react";

import { Badge, AdAccountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import {
  adAccountState,
  filterClients,
  groupByBrand,
  industryLabel,
  locationOf,
  INDUSTRY_LABELS,
  type ClientRow,
} from "@/lib/clients/grouping";

const GRID = "grid grid-cols-[1fr_130px_190px_150px_90px] items-center gap-3 px-6";

export function ClientsView({
  clients,
  loadError,
}: {
  clients: ClientRow[];
  loadError: string | null;
}) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => filterClients(clients, { query, industry }),
    [clients, query, industry],
  );
  const entries = useMemo(() => groupByBrand(filtered), [filtered]);

  const searching = query.trim() !== "" || industry !== "all";
  const groupCount = entries.filter((e) => e.kind === "group").length;
  const allExpanded = groupCount > 0 && expanded.size === groupCount;

  // Searching force-expands, so a matching child is never hidden inside a
  // collapsed brand.
  const isExpanded = (brand: string) => searching || expanded.has(brand);

  function toggle(brand: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });
  }

  function toggleAll() {
    setExpanded(
      allExpanded
        ? new Set()
        : new Set(entries.filter((e) => e.kind === "group").map((e) => (e as { brand: string }).brand)),
    );
  }

  const industriesPresent = [...new Set(clients.map((c) => c.industry))].sort();

  return (
    <>
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-surface px-8">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Clients</h1>
        <Button variant="primary">Add Client</Button>
      </header>

      <div className="mx-auto w-full max-w-[1120px] p-6">
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-raised">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-6 py-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, location or URL"
              aria-label="Search clients"
              className="h-8 w-[280px] rounded-md border border-border-strong bg-surface px-2.5 text-[13px] outline-none placeholder:text-text-tertiary focus:border-accent focus:focus-ring"
            />
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              aria-label="Filter by industry"
              className="h-8 rounded-md border border-border-strong bg-surface px-2.5 text-[13px] outline-none focus:border-accent focus:focus-ring"
            >
              <option value="all">All industries</option>
              {industriesPresent.map((i) => (
                <option key={i} value={i}>{industryLabel(i)}</option>
              ))}
            </select>
            <span className="tabular text-[12px] text-text-secondary">
              {filtered.length} of {clients.length}
            </span>
            {groupCount > 0 && (
              <button
                onClick={toggleAll}
                className="ml-auto text-[12px] text-text-secondary hover:text-text-primary hover:underline"
              >
                {allExpanded ? "Collapse all brands" : "Expand all brands"}
              </button>
            )}
          </div>

          {loadError ? (
            <EmptyState
              icon="!"
              title="Could not load clients"
              body={loadError}
            />
          ) : clients.length === 0 ? (
            <EmptyState
              title="No clients yet"
              body="Add a business and AdFlow can generate its first batch of creative. Clients with several locations get grouped under one brand automatically."
              action={<Button variant="primary">Add Client</Button>}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="⌕"
              title="No clients match your filters"
              body="Nothing matched that search and industry combination. Try a broader search or a different industry."
              action={
                <Button
                  onClick={() => {
                    setQuery("");
                    setIndustry("all");
                  }}
                >
                  Clear search and filter
                </Button>
              }
            />
          ) : (
            <>
              <div
                className={cn(
                  GRID,
                  "border-b border-border bg-[#fafafb] py-2 text-[11px] font-semibold tracking-[0.04em] text-text-tertiary uppercase",
                )}
              >
                <span>Client</span>
                <span>Industry</span>
                <span>Market</span>
                <span>Ad account</span>
                <span />
              </div>

              <ul>
                {entries.map((entry) =>
                  entry.kind === "single" ? (
                    <ClientRowView key={entry.client.id} client={entry.client} />
                  ) : (
                    <li key={entry.brand}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded(entry.brand)}
                        onClick={() => toggle(entry.brand)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggle(entry.brand);
                          }
                        }}
                        className={cn(
                          GRID,
                          "h-11 cursor-pointer border-b border-[#f0f0f2] text-[13px] outline-none hover:bg-surface-muted focus-visible:focus-ring",
                          isExpanded(entry.brand) && "bg-[#fafafb]",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span aria-hidden className="w-3 shrink-0 text-text-tertiary">
                            {isExpanded(entry.brand) ? "▾" : "▸"}
                          </span>
                          <span className="truncate font-semibold">{entry.brand}</span>
                          <Badge>{entry.clients.length} locations</Badge>
                        </span>
                        <span className="truncate text-text-secondary">
                          {entry.industries.length === 1
                            ? industryLabel(entry.industries[0]!)
                            : "Mixed"}
                        </span>
                        <span className="truncate text-text-secondary">
                          {entry.clients.length} markets
                        </span>
                        <span>
                          {entry.connectedCount === entry.clients.length ? (
                            <Badge tone="success" glyph="●">All connected</Badge>
                          ) : (
                            <Badge tone="warning" glyph="▲">
                              {entry.connectedCount} of {entry.clients.length}
                            </Badge>
                          )}
                        </span>
                        <RowActions />
                      </div>

                      {isExpanded(entry.brand) && (
                        <ul>
                          {entry.clients.map((client) => (
                            <ClientRowView key={client.id} client={client} indented />
                          ))}
                        </ul>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ClientRowView({ client, indented = false }: { client: ClientRow; indented?: boolean }) {
  const location = locationOf(client);

  return (
    <li
      className={cn(
        GRID,
        "h-11 border-b border-[#f0f0f2] text-[13px] last:border-b-0 hover:bg-surface-muted",
      )}
    >
      <span className={cn("truncate", indented && "pl-[22px]")}>
        {indented ? (location ?? client.name) : client.name}
      </span>
      <span className="truncate text-text-secondary">{industryLabel(client.industry)}</span>
      <span className="truncate text-text-secondary">
        {client.market_name ?? client.location_description ?? "—"}
      </span>
      <span>
        <AdAccountBadge state={adAccountState(client)} />
      </span>
      <RowActions />
    </li>
  );
}

function RowActions() {
  return (
    <span className="flex justify-end gap-1">
      <Button size="row" variant="ghost">Edit</Button>
      <Button
        size="row"
        variant="ghost"
        className="hover:bg-danger-subtle hover:text-danger-on-subtle"
      >
        Delete
      </Button>
    </span>
  );
}
