"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, MessageSquareText, Network, Route, PlayCircle, Settings, Shapes, PhoneCall, LogOut, Menu, X, CalendarDays, Building2 } from "lucide-react";

const ICONS = {
  dashboard: LayoutDashboard,
  clients: Building2,
  prompts: MessageSquareText,
  contexts: Shapes,
  flows: Network,
  routes: Route,
  simulator: PlayCircle,
  "live-calls": PhoneCall,
  booking: CalendarDays,
  settings: Settings,
} as const;

export type NavIconKey = keyof typeof ICONS;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function withTenant(href: string, tenantId: string | null) {
  if (!tenantId) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}tenantId=${encodeURIComponent(tenantId)}`;
}

export function SidebarNav({
  navigation,
  logoutAction,
}: {
  navigation: { href: string; label: string; icon: NavIconKey }[];
  logoutAction: (formData: FormData) => void | Promise<void>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId");

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">BZ Telecom</p>
        <h1 className="mt-2 text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300/70">Panneau d’administration vocal</p>
      </div>

      <nav className="space-y-1">
        {navigation.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={withTenant(item.href, tenantId)}
              aria-current={active ? "page" : undefined}
              className={[
                "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition",
                active
                  ? "bg-sky-50 text-sky-900 dark:bg-sky-400/10 dark:text-sky-100"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full transition",
                  active ? "bg-sky-600 dark:bg-sky-300" : "bg-transparent group-hover:bg-slate-200 dark:group-hover:bg-white/10",
                ].join(" ")}
              />
              <Icon
                className={[
                  "h-4 w-4",
                  active ? "text-sky-700 dark:text-sky-200" : "text-slate-500 dark:text-slate-300/60",
                ].join(" ")}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 border-t border-slate-200 pt-4">
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </form>
      </div>
    </div>
  );
}

export function MobileNav({
  navigation,
  logoutAction,
  title,
}: {
  navigation: { href: string; label: string; icon: NavIconKey }[];
  logoutAction: (formData: FormData) => void | Promise<void>;
  title: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#070B14]/70 md:-mx-8 md:px-8 lg:hidden">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">BZ Telecom</p>
            <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          />
          <div className="absolute left-3 top-3 h-[calc(100%-1.5rem)] w-[min(22rem,calc(100%-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#070B14]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
              <p className="text-sm font-semibold">Navigation</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-full overflow-auto px-4 py-4">
              <div onClick={() => setOpen(false)}>
                <SidebarNav navigation={navigation} logoutAction={logoutAction} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
