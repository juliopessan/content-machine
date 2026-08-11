// Vercel serverless function. Guarda a chave da OpenRouter como env var
// (OPENROUTER_API_KEY) no servidor, nunca exposta ao navegador.

const OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "openai/gpt-oss-20b:free",
];

const RETRYABLE_STATUS = new Set([404, 429, 502, 503, 504]);

async function requestOnce(model, apiKey, system, userMessage) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://content-machine.vercel.app",
      "X-Title": "Content Machine",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    const err = new Error(
      response.status === 429 ? "rate_limit" : `http_${response.status}: ${errText.slice(0, 150)}`
    );
    err.status = response.status;
    err.retryable = RETRYABLE_STATUS.has(response.status);
    throw err;
  }
  const data = await response.json();
  const choice = data.choices && data.choices[0];
  if (!choice) throw new Error("resposta sem choices no retorno da OpenRouter.");
  const text = choice.message?.content || "";
  return { text, truncated: choice.finish_reason === "length", model };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "server_missing_api_key" });
    return;
  }

  const { system, userMessage } = req.body || {};
  if (!system || !userMessage) {
    res.status(400).json({ error: "missing_fields" });
    return;
  }

  let lastErr = null;
  for (const model of OPENROUTER_MODELS) {
    try {
      const result = await requestOnce(model, apiKey, system, userMessage);
      res.status(200).json(result);
      return;
    } catch (e) {
      lastErr = e;
      if (e.retryable) continue;
      res.status(e.status || 500).json({ error: e.message });
      return;
    }
  }

  res.status(lastErr?.status || 429).json({ error: lastErr?.message || "all_models_failed" });
};
