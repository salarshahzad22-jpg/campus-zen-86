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

    const apiKey = process.env.LOVABLE_API_KEY;
    let reply = "";

    if (!apiKey) {
      reply = "Thanks for your message! (Campus AI is not fully configured yet — connect an AI key to enable smart replies.)";
    } else {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
          },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...ordered.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        });
        if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in the workspace.");
        if (!res.ok) throw new Error(`AI request failed (${res.status})`);
        const json = await res.json();
        reply = json.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a reply.";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "AI request failed";
        throw new Error(msg);
      }
    }

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
