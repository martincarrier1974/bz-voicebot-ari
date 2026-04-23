"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LogOut, Menu, X } from "lucide-react";

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  navigation,
  logoutAction,
}: {
  navigation: { href: string; label: string; icon: LucideIcon }[];
  logoutAction: (formData: FormData) => void | Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">BZ Telecom</p>
        <h1 className="mt-2 text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Panneau d’administration vocal</p>
      </div>

      <nav className="space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition",
                active ? "bg-sky-50 text-sky-900" : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full transition",
                  active ? "bg-sky-600" : "bg-transparent group-hover:bg-slate-200",
                ].join(" ")}
              />
              <Icon className={["h-4 w-4", active ? "text-sky-700" : "text-slate-500"].join(" ")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 border-t border-slate-200 pt-4">
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
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
  navigation: { href: string; label: string; icon: LucideIcon }[];
  logoutAction: (formData: FormData) => void | Promise<void>;
  title: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 lg:hidden">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">BZ Telecom</p>
            <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
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
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          />
          <div className="absolute left-3 top-3 h-[calc(100%-1.5rem)] w-[min(22rem,calc(100%-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold">Navigation</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
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

