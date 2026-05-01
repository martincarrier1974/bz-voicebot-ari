"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, clearSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishRuntimeConfig } from "@/lib/runtime-config";
import { syncFreepbxDirectory } from "@/lib/freepbx-directory";
import { getTenantIdFromFormData, getRuntimeConfigPathForTenant } from "@/lib/tenant";

function toBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function revalidateAdmin() {
  ["/dashboard", "/clients", "/prompts", "/contexts", "/flows", "/routes", "/settings", "/simulator", "/booking", "/live-calls"].forEach(
    (path) => revalidatePath(path),
  );
}

function slugify(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .trim();
}

async function requireTenantId(formData: FormData) {
  const tenantId = await getTenantIdFromFormData(formData);
  if (!tenantId) {
    throw new Error("Aucun client sélectionné.");
  }
  return tenantId;
}

export async function loginAction(formData: FormData) {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });

  const parsed = schema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const validUser = parsed.data.username === (process.env.ADMIN_USERNAME || "admin");
  const validPass = parsed.data.password === (process.env.ADMIN_PASSWORD || "admin123");

  if (!validUser || !validPass) {
    redirect("/login?error=credentials");
  }

  await createSession();
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function saveTenantAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const slug = slugify(String(formData.get("slug") || name));
  const runtimeConfigPathInput = String(formData.get("runtimeConfigPath") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;
  const isActive = toBoolean(formData.get("isActive"));

  if (!name || !slug) {
    throw new Error("Nom et slug client requis.");
  }

  const runtimeConfigPath = runtimeConfigPathInput || getRuntimeConfigPathForTenant({ slug });

  if (id) {
    await prisma.tenant.update({
      where: { id },
      data: { name, slug, runtimeConfigPath, notes, isActive },
    });
  } else {
    await prisma.tenant.create({
      data: { name, slug, runtimeConfigPath, notes, isActive },
    });
  }

  revalidateAdmin();
  redirect("/clients");
}

export async function deleteTenantAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;

  await prisma.tenant.delete({ where: { id } });
  revalidateAdmin();
  redirect("/clients");
}

export async function savePromptAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  const id = String(formData.get("id") || "");
  const data = {
    tenantId,
    key: String(formData.get("key") || ""),
    name: String(formData.get("name") || ""),
    scenario: String(formData.get("scenario") || ""),
    description: String(formData.get("description") || ""),
    content: String(formData.get("content") || ""),
    isActive: toBoolean(formData.get("isActive")),
  };

  if (id) {
    const existing = await prisma.prompt.findUnique({ where: { id } });
    if (existing && existing.content !== data.content) {
      await prisma.promptVersion.create({
        data: { promptId: id, content: existing.content, note: "Sauvegarde précédente" },
      });
    }
    await prisma.prompt.update({ where: { id }, data });
  } else {
    const created = await prisma.prompt.create({ data });
    await prisma.promptVersion.create({
      data: { promptId: created.id, content: created.content, note: "Version initiale" },
    });
  }

  revalidateAdmin();
}

export async function deletePromptAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.prompt.delete({ where: { id } });
    revalidateAdmin();
  }
}

export async function saveContextAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  const id = String(formData.get("id") || "");
  const data = {
    tenantId,
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || ""),
    instructions: String(formData.get("instructions") || ""),
    voiceTone: String(formData.get("voiceTone") || ""),
    rules: String(formData.get("rules") || ""),
    limits: String(formData.get("limits") || ""),
    responseExamples: String(formData.get("responseExamples") || ""),
    isActive: toBoolean(formData.get("isActive")),
  };

  if (id) {
    await prisma.context.update({ where: { id }, data });
  } else {
    await prisma.context.create({ data });
  }

  revalidateAdmin();
}

export async function deleteContextAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.context.delete({ where: { id } });
    revalidateAdmin();
  }
}

export async function saveRouteAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  const id = String(formData.get("id") || "");
  const data = {
    tenantId,
    serviceName: String(formData.get("serviceName") || ""),
    extension: String(formData.get("extension") || ""),
    keywords: String(formData.get("keywords") || ""),
    priority: Number(formData.get("priority") || "100"),
    isActive: toBoolean(formData.get("isActive")),
  };

  if (id) {
    await prisma.routeRule.update({ where: { id }, data });
  } else {
    await prisma.routeRule.create({ data });
  }

  revalidateAdmin();
}

export async function deleteRouteAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.routeRule.delete({ where: { id } });
    revalidateAdmin();
  }
}

export async function saveFlowAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  const id = String(formData.get("id") || "");
  const contextIdValue = String(formData.get("contextId") || "");
  const data = {
    tenantId,
    name: String(formData.get("name") || ""),
    welcomeMessage: String(formData.get("welcomeMessage") || ""),
    silencePrompt: String(formData.get("silencePrompt") || ""),
    ambiguousPrompt: String(formData.get("ambiguousPrompt") || ""),
    fallbackPrompt: String(formData.get("fallbackPrompt") || ""),
    finalAction: String(formData.get("finalAction") || "transfer"),
    destinationLabel: String(formData.get("destinationLabel") || ""),
    destinationPost: String(formData.get("destinationPost") || "105"),
    maxFailedAttempts: Number(formData.get("maxFailedAttempts") || "2"),
    isActive: toBoolean(formData.get("isActive")),
    contextId: contextIdValue || null,
  };

  if (id) {
    await prisma.flow.update({ where: { id }, data });
  } else {
    await prisma.flow.create({ data });
  }

  revalidateAdmin();
}

export async function deleteFlowAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.flow.delete({ where: { id } });
    revalidateAdmin();
  }
}

export async function saveFlowIntentAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const routeRuleIdValue = String(formData.get("routeRuleId") || "");
  const data = {
    flowId: String(formData.get("flowId") || ""),
    routeRuleId: routeRuleIdValue || null,
    label: String(formData.get("label") || ""),
    keywords: String(formData.get("keywords") || ""),
    response: String(formData.get("response") || ""),
    finalAction: String(formData.get("finalAction") || "transfer"),
    destinationPost: String(formData.get("destinationPost") || "105"),
    priority: Number(formData.get("priority") || "100"),
    isActive: toBoolean(formData.get("isActive")),
  };

  if (id) {
    await prisma.flowIntent.update({ where: { id }, data });
  } else {
    await prisma.flowIntent.create({ data });
  }

  revalidateAdmin();
}

export async function deleteFlowIntentAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.flowIntent.delete({ where: { id } });
    revalidateAdmin();
  }
}

export async function saveSettingAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  const data = {
    tenantId,
    key: String(formData.get("key") || ""),
    label: String(formData.get("label") || ""),
    value: String(formData.get("value") || ""),
  };

  const existingByKey = await prisma.setting.findFirst({ where: { tenantId, key: data.key } });

  if (existingByKey) {
    await prisma.setting.update({ where: { id: existingByKey.id }, data });
  } else {
    await prisma.setting.create({ data });
  }

  revalidateAdmin();
  redirect("/settings");
}

export async function syncFreepbxDirectoryAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  await syncFreepbxDirectory(tenantId);
  revalidateAdmin();
}

export async function publishRuntimeConfigAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  await publishRuntimeConfig(tenantId);
  revalidateAdmin();
}

export async function saveBookingServiceAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const data = {
    tenantId,
    name,
    slug: slugify(String(formData.get("slug") || name)),
    description: String(formData.get("description") || "").trim() || null,
    durationMin: Number(formData.get("durationMin") || "30"),
    bufferBeforeMin: Number(formData.get("bufferBeforeMin") || "0"),
    bufferAfterMin: Number(formData.get("bufferAfterMin") || "0"),
    isActive: toBoolean(formData.get("isActive")),
  };

  if (id) {
    await prisma.bookingService.update({ where: { id }, data });
  } else {
    await prisma.bookingService.create({ data });
  }

  revalidateAdmin();
  redirect("/booking");
}

export async function deleteBookingServiceAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.bookingService.delete({ where: { id } });
    revalidateAdmin();
  }
  redirect("/booking");
}

export async function saveCalendarConnectionAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  const id = String(formData.get("id") || "");
  const data = {
    tenantId,
    name: String(formData.get("name") || "").trim(),
    provider: String(formData.get("provider") || "m365").trim(),
    tenantExternalId: String(formData.get("tenantIdExternal") || formData.get("tenantId") || "").trim() || null,
    clientId: String(formData.get("clientId") || "").trim() || null,
    clientSecret: String(formData.get("clientSecret") || "").trim() || null,
    refreshToken: String(formData.get("refreshToken") || "").trim() || null,
    accountEmail: String(formData.get("accountEmail") || "").trim() || null,
    defaultCalendarId: String(formData.get("defaultCalendarId") || "").trim() || null,
    timezone: String(formData.get("timezone") || "").trim() || null,
    isActive: toBoolean(formData.get("isActive")),
  };

  if (id) {
    await prisma.calendarConnection.update({ where: { id }, data });
  } else {
    await prisma.calendarConnection.create({ data });
  }

  revalidateAdmin();
  redirect("/booking");
}

export async function deleteCalendarConnectionAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.calendarConnection.delete({ where: { id } });
    revalidateAdmin();
  }
  redirect("/booking");
}

export async function saveCalendarResourceAction(formData: FormData) {
  const tenantId = await requireTenantId(formData);
  const id = String(formData.get("id") || "");
  const data = {
    tenantId,
    name: String(formData.get("name") || "").trim(),
    employeeName: String(formData.get("employeeName") || "").trim() || null,
    calendarId: String(formData.get("calendarId") || "").trim(),
    calendarAddress: String(formData.get("calendarAddress") || "").trim() || null,
    timezone: String(formData.get("timezone") || "").trim() || null,
    bookingNotes: String(formData.get("bookingNotes") || "").trim() || null,
    connectionId: String(formData.get("connectionId") || "").trim(),
    isActive: toBoolean(formData.get("isActive")),
  };

  if (id) {
    await prisma.calendarResource.update({ where: { id }, data });
  } else {
    await prisma.calendarResource.create({ data });
  }

  revalidateAdmin();
  redirect("/booking");
}

export async function deleteCalendarResourceAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.calendarResource.delete({ where: { id } });
    revalidateAdmin();
  }
  redirect("/booking");
}

export async function saveBookingServiceResourceAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const data = {
    bookingServiceId: String(formData.get("bookingServiceId") || "").trim(),
    calendarResourceId: String(formData.get("calendarResourceId") || "").trim(),
    priority: Number(formData.get("priority") || "100"),
    isActive: toBoolean(formData.get("isActive")),
  };

  if (id) {
    await prisma.bookingServiceResource.update({ where: { id }, data });
  } else {
    await prisma.bookingServiceResource.upsert({
      where: {
        bookingServiceId_calendarResourceId: {
          bookingServiceId: data.bookingServiceId,
          calendarResourceId: data.calendarResourceId,
        },
      },
      update: data,
      create: data,
    });
  }

  revalidateAdmin();
  redirect("/booking");
}

export async function deleteBookingServiceResourceAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.bookingServiceResource.delete({ where: { id } });
    revalidateAdmin();
  }
  redirect("/booking");
}
