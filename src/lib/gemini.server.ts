export const CAMPUS_ZEN_SYSTEM_PROMPT =
  "You are Campus Zen AI, a helpful university assistant. Help students with assignments, attendance, exams, study plans, campus information, productivity, and university guidance.";

export type GeminiTurn = { role: "user" | "assistant"; content: string };

export class GeminiConfigError extends Error {}
export class GeminiRequestError extends Error {}

/**
 * Generate a chat reply via the Lovable AI Gateway.
 * Reads LOVABLE_API_KEY at call time (never at module scope).
 */
export async function generateGeminiReply(turns: GeminiTurn[]): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError("AI is not configured. Please contact support.");
  }

  const messages = [
    { role: "system", content: CAMPUS_ZEN_SYSTEM_PROMPT },
    ...turns.map((t) => ({ role: t.role, content: t.content })),
  ];

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages,
      }),
    });
  } catch (e) {
    throw new GeminiRequestError(
      `AI request failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (res.status === 429)
    throw new GeminiRequestError("Rate limit reached. Please try again in a moment.");
  if (res.status === 402)
    throw new GeminiRequestError("AI credits exhausted. Please add credits in the workspace.");
  if (!res.ok) throw new GeminiRequestError(`AI request failed (${res.status})`);

  const json = await res.json();
  const text: string = (json.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new GeminiRequestError("AI returned an empty response.");
  return text;
}
