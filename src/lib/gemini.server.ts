import { GoogleGenerativeAI } from "@google/generative-ai";

export const CAMPUS_ZEN_SYSTEM_PROMPT =
  "You are Campus Zen AI, a helpful university assistant. Help students with assignments, attendance, exams, study plans, campus information, productivity, and university guidance.";

export type GeminiTurn = { role: "user" | "assistant"; content: string };

export class GeminiConfigError extends Error {}
export class GeminiRequestError extends Error {}

/** Reusable Gemini service. Reads GEMINI_API_KEY at call time (never at module scope). */
export function getGeminiModel(modelName = "gemini-2.0-flash") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError(
      "Gemini is not configured yet — add a GEMINI_API_KEY to enable AI replies.",
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: CAMPUS_ZEN_SYSTEM_PROMPT,
  });
}

/**
 * Generate a chat reply from Gemini given prior turns.
 * The last turn must be the user's newest message.
 */
export async function generateGeminiReply(turns: GeminiTurn[]): Promise<string> {
  const model = getGeminiModel();

  const mapped = turns.map((t) => ({
    role: t.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: t.content }],
  }));

  // History must start with a user turn for the Gemini chat API.
  while (mapped.length > 0 && mapped[0].role !== "user") mapped.shift();

  const last = mapped.pop();
  if (!last) throw new GeminiRequestError("No message to send.");

  try {
    const chat = model.startChat({ history: mapped });
    const result = await chat.sendMessage(last.parts[0].text);
    const text = result.response.text().trim();
    if (!text) throw new GeminiRequestError("Gemini returned an empty response.");
    return text;
  } catch (e) {
    if (e instanceof GeminiRequestError) throw e;
    const raw = e instanceof Error ? e.message : String(e);
    if (/API key/i.test(raw)) throw new GeminiConfigError("Invalid Gemini API key.");
    if (/quota|rate/i.test(raw))
      throw new GeminiRequestError("Gemini rate limit or quota reached. Try again shortly.");
    throw new GeminiRequestError(`Gemini request failed: ${raw}`);
  }
}
