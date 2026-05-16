import OpenAI from "openai";
import type { AIMessage, AIProvider } from "./provider.js";

export function createOpenAIProvider(): AIProvider {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  return {
    name: "openai",
    async complete(system, messages, opts = {}) {
      const response = await client.chat.completions.create({
        model,
        max_tokens: opts.maxTokens ?? 8192,
        response_format: opts.json ? { type: "json_object" } : undefined,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });

      return response.choices[0]?.message.content ?? "";
    },
  };
}
