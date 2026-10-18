const metricLabels = {
  temperature: "temperature",
  rainfall: "rainfall",
  humidity: "humidity",
  soilMoisture: "soil moisture",
  soilPH: "soil pH",
  expense: "expenses",
  income: "income"
};

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_crop_history",
      description: "Read this farmer's recent saved observations for the crop currently being discussed.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "get_measurement_trend",
      description: "Read recorded numeric measurements for one metric. Return actual recorded entries only; never estimate missing values.",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", enum: Object.keys(metricLabels) }
        },
        required: ["metric"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_local_weather",
      description: "Fetch current conditions and a five-day official forecast for this crop's farm coordinates. It is not a field measurement.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  }
];

function buildToolHandlers({ crop, farmer, fetcher }) {
  return {
    get_crop_history: async () => ({
      crop: crop.name,
      records: crop.observations.slice(-12).map(item => ({
        kind: item.kind,
        source: item.source,
        description: item.description.slice(0, 1000),
        values: item.values,
        createdAt: item.createdAt
      }))
    }),
    get_measurement_trend: async ({ metric }) => {
      if (!Object.hasOwn(metricLabels, metric)) return { error: "Choose a supported recorded measurement." };
      const entries = crop.observations
        .filter(item => typeof item.values?.[metric] === "number" && Number.isFinite(item.values[metric]))
        .slice(-30)
        .map(item => ({
          value: Number(item.values[metric]),
          source: item.source,
          createdAt: item.createdAt
        }));
      return { metric: metricLabels[metric], unit: metric === "temperature" ? "°C" : metric === "rainfall" ? "mm" : "", entries };
    },
    get_local_weather: async () => {
      const latitude = crop.latitude ?? farmer.latitude;
      const longitude = crop.longitude ?? farmer.longitude;
      if (latitude == null || longitude == null) {
        return { error: "No farm coordinates are saved for this crop or farmer profile." };
      }
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
        daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
        timezone: "auto",
        forecast_days: "5"
      }).toString();
      const response = await fetcher(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return { error: `Weather service returned status ${response.status}.` };
      const data = await response.json();
      return {
        source: "Open-Meteo forecast; nearby grid, not a field measurement",
        timezone: data.timezone,
        current: data.current,
        daily: data.daily
      };
    }
  };
}

function actionSummary(name, result) {
  if (result.error) return `Could not complete ${name.replaceAll("_", " ")}: ${result.error}`;
  if (name === "get_crop_history") return `Reviewed ${result.records.length} recent crop records`;
  if (name === "get_measurement_trend") return `Reviewed ${result.entries.length} recorded ${result.metric} measurements`;
  if (name === "get_local_weather") return "Retrieved the official five-day forecast";
  return "Used an AGRO data tool";
}

export async function runAgroAgent({
  client,
  model,
  systemPrompt,
  history,
  questionContent,
  crop,
  farmer,
  fetcher = fetch,
  maxToolRounds = 4
}) {
  const handlers = buildToolHandlers({ crop, farmer, fetcher });
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: questionContent }
  ];
  const actions = [];

  for (let round = 0; round <= maxToolRounds; round += 1) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
      max_tokens: 700
    });
    const assistantMessage = completion.choices[0]?.message;
    if (!assistantMessage) throw new Error("The AI service returned an empty response.");
    if (!assistantMessage.tool_calls?.length) {
      const answer = assistantMessage.content;
      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("The AI service returned an empty text answer.");
      }
      return { answer, actions };
    }
    if (round === maxToolRounds) {
      throw new Error("AGRO reached its safe limit for data lookups. Please ask a more specific question.");
    }

    messages.push(assistantMessage);
    for (const [index, toolCall] of assistantMessage.tool_calls.entries()) {
      if (toolCall.type !== "function" || !handlers[toolCall.function.name]) {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: "This tool is not available." })
        });
        continue;
      }
      let result;
      if (index >= 3) {
        result = { error: "AGRO limits each response to three data lookups per round." };
      } else try {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        result = await handlers[toolCall.function.name](args);
      } catch (error) {
        result = { error: error.message || "The data lookup failed." };
      }
      actions.push({
        tool: toolCall.function.name,
        summary: actionSummary(toolCall.function.name, result),
        succeeded: !result.error
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }
  throw new Error("AGRO could not finish the response. Please try again.");
}
