"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, clearSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishRuntimeConfig } from "@/lib/runtime-config";
import { syncFreepbxDirectory } from "@/lib/freepbx-directory";

function toBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function revalidateAdmin() {
  ["/dashboard", "/prompts", "/contexts", "/flows", "/routes", "/settings", "/simulator"].forEach(
    (path) => revalidatePath(path)
  );
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

export async function savePromptAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const data = {
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
  const id = String(formData.get("id") || "");
  const data = {
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
  const id = String(formData.get("id") || "");
  const data = {
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
  const id = String(formData.get("id") || "");
  const contextIdValue = String(formData.get("contextId") || "");
  const data = {
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
  const data = {
    key: String(formData.get("key") || ""),
    label: String(formData.get("label") || ""),
    value: String(formData.get("value") || ""),
  };

  const existingByKey = await prisma.setting.findUnique({ where: { key: data.key } });

  if (existingByKey) {
    await prisma.setting.update({ where: { id: existingByKey.id }, data });
  } else {
    await prisma.setting.create({ data });
  }

  revalidateAdmin();
}

export async function syncFreepbxDirectoryAction() {
  await syncFreepbxDirectory();
  revalidateAdmin();
}

export async function publishRuntimeConfigAction() {
  await publishRuntimeConfig();
  revalidateAdmin();
}
