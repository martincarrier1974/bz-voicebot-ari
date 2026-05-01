"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const ADMIN_TENANT_COOKIE_NAME = "bz_admin_tenant";

type TenantOption = {
  id: string;
  name: string;
  slug: string;
};

export function TenantSelector({
  tenants,
  currentTenantId,
}: {
  tenants: TenantOption[];
  currentTenantId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (tenants.length === 0) return null;

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const tenantId = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (tenantId) {
      params.set("tenantId", tenantId);
      document.cookie = `${ADMIN_TENANT_COOKIE_NAME}=${tenantId}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    } else {
      params.delete("tenantId");
      document.cookie = `${ADMIN_TENANT_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
    }
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <label className="flex min-w-[240px] flex-col gap-1 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400/80">Client actif</span>
      <select
        value={currentTenantId ?? ""}
        onChange={handleChange}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
      >
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name} ({tenant.slug})
          </option>
        ))}
      </select>
    </label>
  );
}
