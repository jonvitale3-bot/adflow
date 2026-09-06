"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/cn";
import { clientPath, sectionFromPath, type Section } from "@/lib/clients/paths";

interface HeaderClient {
  id: string;
  name: string;
  location_label: string | null;
  market_name: string | null;
  location_description: string | null;
}

const STEPS: Array<{ section: Section; label: string }> = [
  { section: "creatives", label: "Creatives" },
  { section: "launch", label: "Launch" },
];

export function ClientHeader({
  client,
  clients,
}: {
  client: HeaderClient;
  clients: Array<{ id: string; name: string }>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const section = sectionFromPath(pathname) ?? "launch";
  const where = client.location_label ?? client.market_name ?? client.location_description;

  return (
    <header className="border-b border-border bg-surface px-6 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/clients"
            className="text-[12px] text-text-secondary hover:text-text-primary hover:underline"
          >
            ← All clients
          </Link>
          <h1 className="mt-0.5 truncate text-[20px] font-semibold tracking-[-0.01em]">
            {client.name}
          </h1>
          {where && <p className="text-[13px] text-text-secondary">{where}</p>}
        </div>

        {/* Type a few letters and go. Thirty-five clients in a native select
            was the scrolling that made every switch a chore. */}
        <div className="w-[280px]">
          <Combobox
            label="Switch client"
            value={client.id}
            options={clients}
            placeholder="Type a client name…"
            onChange={(id) => {
              if (id && id !== client.id) router.push(clientPath(id, section));
            }}
          />
        </div>
      </div>

      <nav aria-label="Client steps" className="mt-3 flex gap-1">
        {STEPS.map((step) => {
          const active = step.section === section;
          return (
            <Link
              key={step.section}
              href={clientPath(client.id, step.section)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 pb-2 text-[13px] font-[550] transition-colors",
                active
                  ? "border-accent text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              {step.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
