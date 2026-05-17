import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIMessage, AIProvider } from "./provider.js";

export function createGeminiProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const client = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

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

      // Gemini uses alternating user/model roles — collapse into a single turn if needed
      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const lastMessage = messages.at(-1)?.content ?? "";

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage);
      return result.response.text();
    },
  };
}
