import { logoutAction } from "@/app/actions";
import { MobileNav, SidebarNav } from "@/components/sidebar-nav";
import type { NavIconKey } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation: { href: string; label: string; icon: NavIconKey }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/prompts", label: "Prompts", icon: "prompts" },
  { href: "/contexts", label: "Contextes", icon: "contexts" },
  { href: "/flows", label: "Flows", icon: "flows" },
  { href: "/routes", label: "Routes", icon: "routes" },
  { href: "/simulator", label: "Simulateur", icon: "simulator" },
  { href: "/live-calls", label: "Appels en direct", icon: "live-calls" },
  { href: "/settings", label: "Paramètres", icon: "settings" },
];

export function AdminShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 border-r border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-950 lg:block">
          <SidebarNav navigation={navigation} logoutAction={logoutAction} />
        </aside>

        <main className="flex-1 px-4 py-6 md:px-8">
          <MobileNav navigation={navigation} logoutAction={logoutAction} title={title} />
          <header className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Administration</p>
                <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
                {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
              </div>
              <div className="pt-2 md:pt-0">
                <ThemeToggle />
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Card({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
