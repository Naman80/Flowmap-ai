import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIMessage, AIProvider } from "./provider.js";

export function createGeminiProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const client = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  return {
    name: "gemini",
    async complete(system, messages, opts = {}) {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: system,
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 8192,
          responseMimeType: opts.json ? "application/json" : "text/plain",
        },
      });

      // Gemini requires strictly alternating user→model turns.
      // Our callers always send a single user message, but guard here anyway:
      // - Drop any trailing assistant messages (they'd be the last turn, which must be user)
      // - Merge consecutive same-role messages into one so history is always alternating
      const normalized = normalizeRoles(messages);

      // Everything except the final user message goes into history
      const history = normalized.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const lastMessage = normalized.at(-1)?.content ?? "";
      if (!lastMessage) throw new Error("Gemini: last message in conversation must be a user message");

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage);
      return result.response.text();
    },
  };
}

/**
 * Ensures the message list ends on a user turn and has no consecutive
 * same-role messages — both required by the Gemini chat API.
 */
function normalizeRoles(messages: AIMessage[]): AIMessage[] {
  if (!messages.length) throw new Error("Gemini: messages array is empty");

  // Merge consecutive same-role messages
  const merged: AIMessage[] = [];
  for (const msg of messages) {
    const prev = merged.at(-1);
    if (prev && prev.role === msg.role) {
      prev.content += "\n" + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }

  // Drop trailing assistant messages — conversation must end with user
  while (merged.length && merged.at(-1)!.role === "assistant") {
    merged.pop();
  }

  if (!merged.length) throw new Error("Gemini: no user messages found after normalization");
  return merged;
}
