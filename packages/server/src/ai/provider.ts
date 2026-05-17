export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIProvider = {
  name: string;
  complete(
    system: string,
    messages: AIMessage[],
    opts?: { json?: boolean; maxTokens?: number }
  ): Promise<string>;
};

let _provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!_provider) throw new Error("Call initAIProvider() at startup before getAIProvider()");
  return _provider;
}

export async function initAIProvider(): Promise<void> {
  const providerName = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

  if (providerName === "openai") {
    const { createOpenAIProvider } = await import("./openai.js");
    _provider = createOpenAIProvider();
  } else if (providerName === "gemini") {
    const { createGeminiProvider } = await import("./gemini.js");
    _provider = createGeminiProvider();
  } else {
    const { createAnthropicProvider } = await import("./anthropic.js");
    _provider = createAnthropicProvider();
  }
}
