import OpenAI from "openai";

export function getAiProvider(env = process.env) {
  const provider = env.AI_PROVIDER || "openai";
  if (!["openai", "ollama"].includes(provider)) {
    throw new Error("AI_PROVIDER must be either 'openai' or 'ollama'.");
  }
  return provider;
}

export function isLocalAi(env = process.env) {
  return getAiProvider(env) === "ollama";
}

export function getAiModel(env = process.env) {
  return isLocalAi(env)
    ? env.AI_MODEL || "llama3.2:latest"
    : env.OPENAI_MODEL || "gpt-4o-mini";
}

export function getAiVisionModel(env = process.env) {
  return env.AI_VISION_MODEL || "qwen2.5vl:3b";
}

export function createAiClient(env = process.env) {
  if (isLocalAi(env)) {
    return new OpenAI({
      apiKey: "ollama",
      baseURL: env.AI_BASE_URL || "http://127.0.0.1:11434/v1",
      timeout: 120000,
      maxRetries: 0
    });
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("AI is not configured. Set AI_PROVIDER=ollama for local AI or add OPENAI_API_KEY for OpenAI.");
  }
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}
