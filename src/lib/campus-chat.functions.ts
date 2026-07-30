import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});


export const sendCampusChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SendSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Persist user message
    await context.supabase.from("chat_messages").insert({
      user_id: context.userId,
      role: "user",
      content: data.message,
    });

    // Load recent history for context (last 20)
    const { data: history } = await context.supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const ordered = (history ?? []).slice().reverse();

    const { generateGeminiReply } = await import("./gemini.server");
    const reply = await generateGeminiReply(
      ordered.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    );


    const { data: inserted, error } = await context.supabase
      .from("chat_messages")
      .insert({
        user_id: context.userId,
        role: "assistant",
        content: reply,
      })
      .select("id, role, content, created_at")
      .single();

    if (error) throw new Error(error.message);
    return inserted;
  });

export const clearCampusChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("chat_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
