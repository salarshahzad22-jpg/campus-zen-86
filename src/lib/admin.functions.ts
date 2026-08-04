import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.enum(["admin", "moderator", "student"]);

const SetRoleSchema = z.object({
  userId: z.string().uuid(),
  role: RoleSchema,
  grant: z.boolean(),
});

const DeleteUserSchema = z.object({ userId: z.string().uuid() });

type AdminContext = {
  supabase: {
    from: (table: "user_roles") => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown }> };
        };
      };
    };
  };
  userId: string;
};

/**
 * Verifies the caller is an admin using their own RLS-scoped client.
 * Reads the role row directly ("users read own roles" policy) — the privileged
 * role helper lives in a private schema and is not callable from the API.
 */
async function assertAdmin(context: AdminContext) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden — admin access required.");
}


export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: authUsers }, { data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabaseAdmin.from("profiles").select("id, full_name, university, department, semester"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
    }

    return (authUsers?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      verified: Boolean(u.email_confirmed_at),
      fullName: profileById.get(u.id)?.full_name ?? "",
      university: profileById.get(u.id)?.university ?? "",
      department: profileById.get(u.id)?.department ?? "",
      semester: profileById.get(u.id)?.semester ?? "",
      roles: rolesByUser.get(u.id) ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.grant && data.userId === context.userId && data.role === "admin") {
      throw new Error("You cannot remove your own admin role.");
    }

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminContext);
    if (data.userId === context.userId) throw new Error("Use Settings to delete your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tables = ["profiles", "assignments", "attendance", "exams", "resources", "chat_messages"] as const;
    const counts: Record<string, number> = {};
    await Promise.all(
      tables.map(async (t) => {
        const { count } = await supabaseAdmin.from(t).select("*", { count: "exact", head: true });
        counts[t] = count ?? 0;
      }),
    );

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: newUsers } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    return { counts, newUsersLast7Days: newUsers ?? 0 };
  });
