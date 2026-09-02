import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminCtx = {
  supabase: {
    from: (table: "user_roles") => {
      select: (cols: string) => {
        eq: (
          c: string,
          v: string,
        ) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } };
      };
    };
  };
  userId: string;
};

async function assertAdmin(context: AdminCtx) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden — admin access required.");
}

const NoticeSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
  published: z.boolean().default(true),
});

const EventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional().default(""),
  location: z.string().trim().max(160).optional().default(""),
  category: z.string().trim().min(1).max(40).default("general"),
  starts_at: z.string().min(1),
  ends_at: z.string().optional().nullable(),
  published: z.boolean().default(true),
});

const IdSchema = z.object({ id: z.string().uuid() });

/* -------------------------------- Notices -------------------------------- */

export const listNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id, title, body, published, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NoticeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      title: data.title,
      body: data.body,
      published: data.published,
      author_id: context.userId,
    };
    const { error } = data.id
      ? await supabaseAdmin.from("announcements").update(row).eq("id", data.id)
      : await supabaseAdmin.from("announcements").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- Events -------------------------------- */

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id, title, description, location, category, starts_at, ends_at, published")
      .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      category: data.category,
      starts_at: new Date(data.starts_at).toISOString(),
      ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
      published: data.published,
      author_id: context.userId,
    };
    const { error } = data.id
      ? await supabaseAdmin.from("events").update(row).eq("id", data.id)
      : await supabaseAdmin.from("events").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ AI usage ---------------------------------- */

export const getAiUsageReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 29 * 24 * 3600 * 1000);
    const [{ data: chats }, { data: plans }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("chat_messages")
        .select("user_id, role, created_at")
        .gte("created_at", since.toISOString()),
      supabaseAdmin
        .from("ai_requests")
        .select("user_id, subject, task_type, created_at")
        .gte("created_at", since.toISOString()),
      supabaseAdmin.from("profiles").select("id, full_name"),
    ]);

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? ""]));
    const chatRows = chats ?? [];
    const planRows = plans ?? [];

    // Daily series for the last 14 days
    const days: { day: string; chats: number; plans: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      days.push({
        day: d,
        chats: chatRows.filter((c) => c.role === "user" && c.created_at.slice(0, 10) === d).length,
        plans: planRows.filter((p) => p.created_at.slice(0, 10) === d).length,
      });
    }

    const perUser = new Map<string, { userId: string; name: string; chats: number; plans: number }>();
    const bump = (userId: string, key: "chats" | "plans") => {
      const entry = perUser.get(userId) ?? {
        userId,
        name: nameById.get(userId) ?? "Unknown user",
        chats: 0,
        plans: 0,
      };
      entry[key] += 1;
      perUser.set(userId, entry);
    };
    for (const c of chatRows) if (c.role === "user") bump(c.user_id, "chats");
    for (const p of planRows) bump(p.user_id, "plans");

    const topSubjects = new Map<string, number>();
    for (const p of planRows) {
      const s = (p.subject || "Unspecified").trim();
      topSubjects.set(s, (topSubjects.get(s) ?? 0) + 1);
    }

    return {
      totalChatPrompts: chatRows.filter((c) => c.role === "user").length,
      totalAiReplies: chatRows.filter((c) => c.role === "assistant").length,
      totalStudyPlans: planRows.length,
      activeUsers: perUser.size,
      days,
      topUsers: [...perUser.values()].sort((a, b) => b.chats + b.plans - (a.chats + a.plans)).slice(0, 10),
      topSubjects: [...topSubjects.entries()]
        .map(([subject, count]) => ({ subject, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    };
  });
