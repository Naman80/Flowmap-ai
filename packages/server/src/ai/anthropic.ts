import Anthropic from "@anthropic-ai/sdk";
import type { AIMessage, AIProvider } from "./provider.js";

export function createAnthropicProvider(): AIProvider {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  return {
    name: "anthropic",
    async complete(system, messages, opts = {}) {
      const response = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 8192,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const block = response.content[0];
      if (block.type !== "text") throw new Error("Unexpected response type from Anthropic");
      return block.text;
    },
  };
}
