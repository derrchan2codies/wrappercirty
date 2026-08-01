const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const DEFAULT_MODEL = "gpt-5.6-luna";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function extractText(result: unknown) {
  if (!result || typeof result !== "object") {
    return "";
  }

  if (
    "output_text" in result &&
    typeof result.output_text === "string" &&
    result.output_text.trim()
  ) {
    return result.output_text.trim();
  }

  const output =
    "output" in result && Array.isArray(result.output) ? result.output : [];

  const text = output
    .flatMap((item) =>
      item && typeof item === "object" && "content" in item ? item.content : []
    )
    .filter(
      (content): content is { type: string; text: string } =>
        Boolean(content) &&
        typeof content === "object" &&
        "type" in content &&
        content.type === "output_text" &&
        "text" in content &&
        typeof content.text === "string"
    )
    .map((content) => content.text)
    .join("\n")
    .trim();

  return text || "";
}

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body: { prompt?: unknown };

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return jsonResponse({ error: "Please enter a question." }, 400);
  }

  if (prompt.length > 20_000) {
    return jsonResponse({ error: "Your question is too long." }, 400);
  }

  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  if (!baseUrl || !apiKey) {
    console.error(
      "Netlify AI Gateway environment variables are unavailable."
    );

    return jsonResponse(
      {
        error:
          "The chat service is not configured yet. Please try again shortly.",
      },
      503
    );
  }

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/responses`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: prompt,
          max_output_tokens: 1200,
        }),
        signal: AbortSignal.timeout(55_000),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();

      console.error(
        `AI Gateway request failed with status ${response.status}.`,
        errorBody
      );

      return jsonResponse(
        {
          error:
            "The assistant could not answer right now. Please try again.",
        },
        response.status === 429 ? 429 : 502
      );
    }

    const result = await response.json();
    const answer = extractText(result);

    if (!answer) {
      console.error("AI Gateway returned a response without text.");

      return jsonResponse(
        {
          error:
            "The assistant returned an empty answer. Please try again.",
        },
        502
      );
    }

    return jsonResponse({ answer });
  } catch (error) {
    console.error("Chat request failed.", error);

    const timedOut =
      error instanceof Error && error.name === "TimeoutError";

    return jsonResponse(
      {
        error: timedOut
          ? "The assistant took too long to respond. Please try again."
          : "The chat service is temporarily unavailable. Please try again.",
      },
      timedOut ? 504 : 502
    );
  }
}

export const config = {
  path: "/api/chat",
  method: "POST",
};
