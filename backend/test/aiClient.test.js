import test from "node:test";
import assert from "node:assert/strict";
import { createAiClient, getAiModel, getAiProvider, getAiVisionModel, isLocalAi } from "../src/services/aiClient.js";

test("defaults to OpenAI and its configured model", () => {
  assert.equal(getAiProvider({}), "openai");
  assert.equal(getAiModel({ OPENAI_MODEL: "test-model" }), "test-model");
  assert.equal(isLocalAi({}), false);
});

test("configures an Ollama OpenAI-compatible client without a paid API key", () => {
  const env = { AI_PROVIDER: "ollama", AI_MODEL: "qwen3:4b" };
  const client = createAiClient(env);

  assert.equal(getAiProvider(env), "ollama");
  assert.equal(getAiModel(env), "qwen3:4b");
  assert.equal(isLocalAi(env), true);
  assert.equal(client.baseURL, "http://127.0.0.1:11434/v1");
  assert.equal(client.apiKey, "ollama");
});

test("uses documented local text and vision defaults with configurable overrides", () => {
  assert.equal(getAiModel({ AI_PROVIDER: "ollama" }), "llama3.2:latest");
  assert.equal(getAiVisionModel({}), "qwen2.5vl:3b");
  assert.equal(getAiVisionModel({ AI_VISION_MODEL: "vision-test" }), "vision-test");
});

test("requires an OpenAI key in OpenAI mode and rejects unsupported providers", () => {
  assert.throws(() => createAiClient({ AI_PROVIDER: "openai" }), /OPENAI_API_KEY/);
  assert.throws(() => getAiProvider({ AI_PROVIDER: "unknown" }), /AI_PROVIDER/);
});
