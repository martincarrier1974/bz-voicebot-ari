import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const ADMIN_TENANT_COOKIE_NAME = "bz_admin_tenant";

type SearchParamsLike =
  | Promise<{ tenantId?: string }>
  | { tenantId?: string }
  | undefined;

export async function getTenantContext(searchParams?: SearchParamsLike) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
  });

  const requestedTenantId = params?.tenantId?.trim() || cookieStore.get(ADMIN_TENANT_COOKIE_NAME)?.value || "";
  const currentTenant = tenants.find((tenant) => tenant.id === requestedTenantId) ?? tenants[0] ?? null;

  return {
    tenants,
    currentTenant,
    tenantId: currentTenant?.id ?? null,
  };
}

export async function getTenantIdFromFormData(formData: FormData) {
  const explicit = String(formData.get("tenantId") || "").trim();
  if (explicit) return explicit;
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_TENANT_COOKIE_NAME)?.value?.trim() || "";
}

export function getRuntimeConfigPathForTenant(tenant: { slug: string; runtimeConfigPath?: string | null }) {
  return tenant.runtimeConfigPath?.trim() || `runtime/tenants/${tenant.slug}/voicebot-config.json`;
}

export function getLiveCallsPathForTenant(tenant: { slug: string; runtimeConfigPath?: string | null }) {
  const runtimeConfigPath = getRuntimeConfigPathForTenant(tenant);
  return runtimeConfigPath.replace(/[^/]+$/, "live-calls.json");
}
