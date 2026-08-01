const JSON_HEADERS = {
   "Content-Type": "application/json; charset=utf-8",
   "Cache-Control": "no-store",
 };
 
- function jsonResponse(body: unknown, status = 200) {
+const DEFAULT_MODEL = "gpt-5.6-luna";
+
+type OpenAIConfig = {
+  apiKey: string;
+  baseUrl: string;
+  model: string;
+};
+
+function jsonResponse(body: unknown, status = 200) {
   return new Response(JSON.stringify(body), {
     status,
     headers: JSON_HEADERS,
   });
 }
 
- function extractText(result: any) {
-  if (typeof result.output_text === "string" && result.output_text.trim()) {
+function cleanBaseUrl(baseUrl: string) {
+  return baseUrl.replace(/\/+$/, "");
+}
+
+function createResponsesUrl(baseUrl: string) {
+  const cleanUrl = cleanBaseUrl(baseUrl);
+  return cleanUrl.endsWith("/v1")
+    ? `${cleanUrl}/responses`
+    : `${cleanUrl}/v1/responses`;
+}
+
+function getOpenAIConfig(): OpenAIConfig | undefined {
+  const apiKey = process.env.OPENAI_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY;
+  const baseUrl = process.env.OPENAI_BASE_URL || process.env.NETLIFY_AI_GATEWAY_BASE_URL;
+
+  if (!apiKey || !baseUrl) {
+    return undefined;
+  }
+
+  return {
+    apiKey,
+    baseUrl,
+    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
+  };
+}
+
+function extractText(result: unknown) {
+  if (!result || typeof result !== "object") {
+    return "";
+  }
+
+  if ("output_text" in result && typeof result.output_text === "string" && result.output_text.trim()) {
     return result.output_text.trim();
   }
 
-   const text = result.output
-    ?.flatMap((item: any) => item.content ?? [])
-    .filter((content: any) => content.type === "output_text")
-    .map((content: any) => content.text)
-    .filter((content: unknown) => typeof content === "string")
+  const output = "output" in result && Array.isArray(result.output) ? result.output : [];
+  const text = output
+    .flatMap((item) => (item && typeof item === "object" && "content" in item ? item.content : []))
+    .filter((content): content is { type: string; text: string } => (
+      Boolean(content)
+      && typeof content === "object"
+      && "type" in content
+      && content.type === "output_text"
+      && "text" in content
+      && typeof content.text === "string"
+    ))
+    .map((content) => content.text)
     .join("\n")
     .trim();
 
-   return text || "";
+  return text || "";
 }
 
- export default async function handler(request: Request) {
+export default async function handler(request: Request) {
   if (request.method !== "POST") {
     return jsonResponse({ error: "Method not allowed." }, 405);
   }
 
-   let body: { prompt?: unknown };
+  let body: { prompt?: unknown };
 
-   try {
+  try {
     body = await request.json();
   } catch {
     return jsonResponse({ error: "Invalid request body." }, 400);
   }
 
-   const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
+  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
 
-   if (!prompt) {
+  if (!prompt) {
     return jsonResponse({ error: "Please enter a question." }, 400);
   }
 
-   if (prompt.length > 20_000) {
+  if (prompt.length > 20_000) {
     return jsonResponse({ error: "Your question is too long." }, 400);
   }
 
-   const baseUrl = process.env.OPENAI_BASE_URL;
-  const apiKey = process.env.OPENAI_API_KEY;
+  const openaiConfig = getOpenAIConfig();
 
-   if (!baseUrl || !apiKey) {
-    console.error("Netlify AI Gateway environment variables are unavailable.");
+  if (!openaiConfig) {
+    console.error("OpenAI or Netlify AI Gateway environment variables are unavailable.");
     return jsonResponse(
-      { error: "The chat service is not configured yet. Please try again shortly." },
+      { error: "The chat service is missing its AI Gateway credentials. Please redeploy with Netlify AI enabled." },
       503,
     );
   }
 
-   try {
-    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/responses`, {
+  try {
+    const response = await fetch(createResponsesUrl(openaiConfig.baseUrl), {
       method: "POST",
       headers: {
-        Authorization: `Bearer ${apiKey}`,
+        Authorization: `Bearer ${openaiConfig.apiKey}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
-        model: "gpt-5.6-luna",
+        model: openaiConfig.model,
         input: prompt,
         max_output_tokens: 1200,
       }),
       signal: AbortSignal.timeout(55_000),
     });
 
-     if (!response.ok) {
+    if (!response.ok) {
       const errorBody = await response.text();
       console.error(`AI Gateway request failed with status ${response.status}.`, errorBody);
       return jsonResponse(
         { error: "The assistant could not answer right now. Please try again." },
         response.status === 429 ? 429 : 502,
       );
     }
 
-     const result = await response.json();
+    const result = await response.json();
     const answer = extractText(result);
 
-     if (!answer) {
+    if (!answer) {
       console.error("AI Gateway returned a response without text.");
       return jsonResponse(
         { error: "The assistant returned an empty answer. Please try again." },
         502,
       );
     }
 
-     return jsonResponse({ answer });
+    return jsonResponse({ answer });
   } catch (error) {
     console.error("Chat request failed.", error);
     const timedOut = error instanceof Error && error.name === "TimeoutError";
     return jsonResponse(
       {
         error: timedOut
           ? "The assistant took too long to respond. Please try again."
           : "The chat service is temporarily unavailable. Please try again.",
       },
       timedOut ? 504 : 502,
     );
   }
 }
 
- export const config = {
+export const config = {
   path: "/api/chat",
   method: "POST",
 };
-
