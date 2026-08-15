// api/chat.js

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const DEFAULT_MODEL = "gpt-5.6-luna";

function jsonResponse(res, body, status = 200, extraHeaders = {}) {
  res.writeHead(status, {
    ...JSON_HEADERS,
    ...extraHeaders,
  });

  res.end(JSON.stringify(body));
}

function cleanBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function createResponsesUrl(baseUrl) {
  const cleanUrl = cleanBaseUrl(baseUrl);

  return cleanUrl.endsWith("/v1")
    ? `${cleanUrl}/responses`
    : `${cleanUrl}/v1/responses`;
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return undefined;
  }

  return {
    apiKey,
    // Use a different OpenAI-compatible provider or gateway by setting this.
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
  };
}

function parseRequestBody(req) {
  let body = req.body;

  if (Buffer.isBuffer(body)) {
    body = body.toString("utf8");
  }

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  return body;
}

function extractText(result) {
  if (!result || typeof result !== "object") {
    return "";
  }

  if (
    typeof result.output_text === "string" &&
    result.output_text.trim()
  ) {
    return result.output_text.trim();
  }

  const output = Array.isArray(result.output) ? result.output : [];

  return output
    .flatMap((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        !Array.isArray(item.content)
      ) {
        return [];
      }

      return item.content;
    })
    .filter(
      (content) =>
        content &&
        typeof content === "object" &&
        content.type === "output_text" &&
        typeof content.text === "string",
    )
    .map((content) => content.text)
    .join("\n")
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return jsonResponse(
      res,
      { error: "Method not allowed." },
      405,
      { Allow: "POST" },
    );
  }

  const body = parseRequestBody(req);

  if (!body) {
    return jsonResponse(res, { error: "Invalid request body." }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return jsonResponse(res, { error: "Please enter a question." }, 400);
  }

  if (prompt.length > 20_000) {
    return jsonResponse(res, { error: "Your question is too long." }, 400);
  }

  const openaiConfig = getOpenAIConfig();

  if (!openaiConfig) {
    console.error("OPENAI_API_KEY is unavailable.");

    return jsonResponse(
      res,
      {
        error:
          "The chat service is not configured yet. Please try again shortly.",
      },
      503,
    );
  }

  try {
    const response = await fetch(
      createResponsesUrl(openaiConfig.baseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openaiConfig.model,
          input: prompt,
          max_output_tokens: 1200,
        }),
        signal: AbortSignal.timeout(55_000),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();

      console.error(
        `OpenAI request failed with status ${response.status}.`,
        errorBody,
      );

      return jsonResponse(
        res,
        { error: "The assistant could not answer right now. Please try again." },
        response.status === 429 ? 429 : 502,
      );
    }

    const result = await response.json();
    const answer = extractText(result);

    if (!answer) {
      console.error("OpenAI returned a response without text.");

      return jsonResponse(
        res,
        { error: "The assistant returned an empty answer. Please try again." },
        502,
      );
    }

    return jsonResponse(res, { answer });
  } catch (error) {
    console.error("Chat request failed.", error);

    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return jsonResponse(
      res,
      {
        error: timedOut
          ? "The assistant took too long to respond. Please try again."
          : "The chat service is temporarily unavailable. Please try again.",
      },
      timedOut ? 504 : 502,
    );
  }
}
