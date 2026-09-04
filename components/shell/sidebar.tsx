"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  countKey?: "clients" | "creatives";
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const NAV: NavItem[] = [
  {
    href: "/clients",
    label: "Clients",
    countKey: "clients",
    icon: (
      <svg viewBox="0 0 15 15" width={15} height={15} {...stroke}>
        <path d="M2 13V5l4.5-3L11 5v8" />
        <path d="M1 13h13M5 8h3M5 10.5h3" />
      </svg>
    ),
  },
  {
    href: "/creatives",
    label: "Creatives",
    countKey: "creatives",
    icon: (
      <svg viewBox="0 0 15 15" width={15} height={15} {...stroke}>
        <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" />
        <path d="M1.5 10l3.5-3 3 2.5 2.5-2 3 2.5" />
        <circle cx="5.5" cy="5.5" r="1" />
      </svg>
    ),
  },
  {
    href: "/launch",
    label: "Launch",
    icon: (
      <svg viewBox="0 0 15 15" width={15} height={15} {...stroke}>
        <path d="M7.5 1.5c2.5 1.5 4 4 4 7l-4 4-4-4c0-3 1.5-5.5 4-7z" />
        <circle cx="7.5" cy="6" r="1.5" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 15 15" width={15} height={15} {...stroke}>
        <circle cx="7.5" cy="7.5" r="2.2" />
        <path d="M7.5 1v1.8M7.5 12.2V14M14 7.5h-1.8M2.8 7.5H1M12 3l-1.3 1.3M4.3 10.7L3 12M12 12l-1.3-1.3M4.3 4.3L3 3" />
      </svg>
    ),
  },
];

export function Sidebar({
  email,
  counts,
}: {
  email: string;
  counts: { clients: number; creatives: number };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Collapse automatically on a narrow window, per the handoff.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const initials = email.slice(0, 2).toUpperCase();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav
      aria-label="Main"
      style={{ width: collapsed ? 52 : 220 }}
      // Pinned to the viewport: navigation that scrolls away is navigation you
      // have to scroll back for, and these screens are long.
      className="sticky top-0 flex h-dvh shrink-0 flex-col overflow-y-auto border-r border-border bg-background px-2.5 py-3 transition-[width] duration-200 ease-out"
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
        <div className="flex items-center gap-2">
          <div aria-hidden className="h-5 w-5 shrink-0 rounded-[5px] bg-accent" />
          {!collapsed && <span className="text-[14px] font-semibold">AdFlow</span>}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="rounded p-1 text-text-tertiary hover:text-text-primary"
          >
            <svg viewBox="0 0 12 12" width={12} height={12} {...stroke}>
              <path d="M7.5 2.5L4 6l3.5 3.5" />
            </svg>
          </button>
        )}
      </div>

      <ul className="mt-3.5 flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const count = item.countKey ? counts[item.countKey] : undefined;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[30px] items-center gap-[9px] rounded-md text-[13px] font-[550] transition-colors duration-150 ease-out",
                  collapsed ? "justify-center px-0" : "px-2",
                  active
                    ? "bg-[#e7e7ea] text-text-primary"
                    : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
                )}
              >
                <span className="shrink-0 opacity-90">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {count !== undefined && count > 0 && (
                      <span className="tabular text-[11px] font-semibold text-text-tertiary">
                        {count}
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-border pt-2.5">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <div
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d9e3f7] text-[11px] font-semibold text-accent-hover"
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-[550]">{email}</p>
              <button
                onClick={signOut}
                className="text-[11px] text-text-secondary hover:text-text-primary hover:underline"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
        {collapsed && (
          <button
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="mt-2 w-full text-center text-[11px] text-text-secondary hover:text-text-primary"
          >
            ⏻
          </button>
        )}
      </div>
    </nav>
  );
}
