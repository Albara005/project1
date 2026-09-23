"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/nav-items";
import type { ModuleKey } from "@/lib/rbac";

export function Sidebar({
  organizationName,
  allowedModules,
}: {
  organizationName: string;
  allowedModules: ModuleKey[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowedModules.includes(item.module)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 start-3 z-30 rounded-lg bg-sidebar p-2 text-sidebar-foreground lg:hidden print:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 print:hidden",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          // في RTL تكون بداية السطر يميناً، فتُخفى الشريحة بإزاحتها يميناً خارج الشاشة
          "start-0 lg:start-auto",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div>
            <p className="text-lg font-bold">نظام ERP</p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {organizationName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/40">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block rounded-lg px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-sidebar-foreground",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
