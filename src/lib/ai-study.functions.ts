import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  deadline: z.string().trim().max(50).optional().default(""),
  task_type: z.string().trim().min(1).max(100),
  progress: z.string().trim().max(1000).optional().default(""),
});

export type StudyPlan = {
  goal: string;
  action_plan: string[];
  daily_checklist: string[];
  revision_tips: string[];
};

export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please contact support.");

    const prompt = `You are a friendly, practical study coach helping a university student.

Student input:
- Subject: ${data.subject}
- Deadline: ${data.deadline || "not specified"}
- Task type: ${data.task_type}
- Current progress: ${data.progress || "not specified"}

Return JSON with this exact shape:
{
  "goal": "one short, motivating sentence stating what they'll achieve",
  "action_plan": ["step 1", "step 2", "step 3"],
  "daily_checklist": ["4-6 concrete daily tasks"],
  "revision_tips": ["3-5 practical revision tips specific to the subject/task"]
}

Keep everything concise, encouraging, and student-friendly. Return ONLY valid JSON.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: "You output ONLY valid JSON matching the requested schema." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in the workspace.");
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let plan: StudyPlan;
    try {
      plan = JSON.parse(content);
    } catch {
      throw new Error("Could not parse AI response. Please try again.");
    }

    // Persist history
    await context.supabase.from("ai_requests").insert({
      user_id: context.userId,
      subject: data.subject,
      deadline: data.deadline || null,
      task_type: data.task_type,
      progress: data.progress || null,
      response: plan,
    });

    return plan;
  });
