import test from "node:test";
import assert from "node:assert/strict";
import { runAgroAgent } from "../src/services/agroAgent.js";

const crop = {
  name: "Chilli",
  latitude: 8.3,
  longitude: 80.4,
  observations: [
    { kind: "soil", source: "lab_test", description: "Soil test", values: { soilPH: 6.2 }, createdAt: new Date("2026-10-01") },
    { kind: "growth", source: "farmer", description: "New leaves", values: { soilMoisture: 35 }, createdAt: new Date("2026-10-02") }
  ]
};
const farmer = { language: "en", latitude: 7.8, longitude: 80.7 };

function mockClient(responses, onRequest = () => {}) {
  const requests = [];
  return {
    requests,
    client: {
      chat: {
        completions: {
          create: async request => {
            requests.push(request);
            onRequest(request);
            const response = responses.shift();
            if (!response) throw new Error("Unexpected model request");
            return { choices: [{ message: response }] };
          }
        }
      }
    }
  };
}

function toolCall(name, args = {}, id = "call-1") {
  return {
    role: "assistant",
    tool_calls: [{
      id,
      type: "function",
      function: { name, arguments: JSON.stringify(args) }
    }]
  };
}

test("returns a model answer without making unnecessary tool calls", async () => {
  const { client, requests } = mockClient([{ role: "assistant", content: "Water the chilli when the measured soil is dry." }]);
  const result = await runAgroAgent({ client, model: "test-model", systemPrompt: "AGRO", history: [], questionContent: "Help", crop, farmer });

  assert.equal(result.answer, "Water the chilli when the measured soil is dry.");
  assert.deepEqual(result.actions, []);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].tools.length, 3);
});

test("executes authorized crop-history tools and returns their result to the model", async () => {
  const { client, requests } = mockClient([
    toolCall("get_crop_history"),
    { role: "assistant", content: "Your records include a lab soil test and a new-leaf observation." }
  ], request => {
    if (request.messages.some(message => message.role === "tool")) {
      const result = JSON.parse(request.messages.find(message => message.role === "tool").content);
      assert.equal(result.records.length, 2);
      assert.equal(result.records[0].source, "lab_test");
    }
  });
  const result = await runAgroAgent({ client, model: "test-model", systemPrompt: "AGRO", history: [], questionContent: "Check my crop journal", crop, farmer });

  assert.match(result.actions[0].summary, /Reviewed 2 recent crop records/);
  assert.equal(result.actions[0].succeeded, true);
  assert.equal(requests.length, 2);
});

test("uses saved numeric measurements without inventing missing values", async () => {
  const { client } = mockClient([
    toolCall("get_measurement_trend", { metric: "soilPH" }),
    {
      role: "assistant",
      content: "Your recorded lab pH is 6.2. There are no other pH measurements to compare."
    }
  ], request => {
    const toolMessage = request.messages.find(message => message.role === "tool");
    if (toolMessage) {
      const result = JSON.parse(toolMessage.content);
      assert.equal(result.entries.length, 1);
      assert.equal(result.entries[0].value, 6.2);
    }
  });
  const result = await runAgroAgent({ client, model: "test-model", systemPrompt: "AGRO", history: [], questionContent: "How has pH changed?", crop, farmer });

  assert.match(result.answer, /recorded lab pH/);
  assert.equal(result.actions[0].succeeded, true);
});

test("retrieves forecast with crop coordinates and identifies the source", async () => {
  let calledUrl;
  const forecast = { timezone: "Asia/Colombo", current: { temperature_2m: 30 }, daily: { time: ["2026-10-17"] } };
  const fetcher = async url => {
    calledUrl = new URL(url);
    return { ok: true, json: async () => forecast };
  };
  const { client } = mockClient([
    toolCall("get_local_weather"),
    { role: "assistant", content: "The nearby forecast reports 30°C." }
  ], request => {
    const toolMessage = request.messages.find(message => message.role === "tool");
    if (toolMessage) {
      const result = JSON.parse(toolMessage.content);
      assert.equal(result.source, "Open-Meteo forecast; nearby grid, not a field measurement");
      assert.equal(result.current.temperature_2m, 30);
    }
  });
  const result = await runAgroAgent({ client, model: "test-model", systemPrompt: "AGRO", history: [], questionContent: "Will it rain?", crop, farmer, fetcher });

  assert.equal(calledUrl.searchParams.get("latitude"), "8.3");
  assert.equal(calledUrl.searchParams.get("longitude"), "80.4");
  assert.equal(result.actions[0].succeeded, true);
});

test("surfaces missing farm coordinates as a failed lookup, not a guessed forecast", async () => {
  const { client } = mockClient([
    toolCall("get_local_weather"),
    { role: "assistant", content: "I could not retrieve a local forecast because this crop has no saved coordinates." }
  ], request => {
    const toolMessage = request.messages.find(message => message.role === "tool");
    if (toolMessage) assert.match(JSON.parse(toolMessage.content).error, /No farm coordinates/);
  });
  const result = await runAgroAgent({
    client, model: "test-model", systemPrompt: "AGRO", history: [], questionContent: "Will it rain?",
    crop: { ...crop, latitude: undefined, longitude: undefined },
    farmer: { language: "en" },
    fetcher: async () => { throw new Error("Weather fetch must not be called without coordinates"); }
  });

  assert.equal(result.actions[0].succeeded, false);
});

test("stops safely when the model keeps requesting tools", async () => {
  const { client } = mockClient([toolCall("get_crop_history"), toolCall("get_crop_history")]);
  await assert.rejects(
    runAgroAgent({
      client, model: "test-model", systemPrompt: "AGRO", history: [], questionContent: "Check everything",
      crop, farmer, maxToolRounds: 1
    }),
    /safe limit/
  );
});
