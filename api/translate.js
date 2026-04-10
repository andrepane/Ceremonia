const DEEPL_DEFAULT_BASE_URL = "https://api-free.deepl.com";
const MAGIC_LOOPS_DEFAULT_ENDPOINT =
  "https://magicloops.dev/api/loop/1f32ffbd-1eb5-4e1c-ab57-f0a322e5a1c3/run";

function json(res, statusCode, body) {
  res.status(statusCode).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

function normalizeLanguageCode(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function resolveTargetLang(inputTargetLang, inputSourceLang) {
  const target = normalizeLanguageCode(inputTargetLang);
  const source = normalizeLanguageCode(inputSourceLang);

  if (target === "es" || target === "it") {
    return target.toUpperCase();
  }

  if (source === "es") return "IT";
  if (source === "it") return "ES";

  return "";
}

async function translateWithDeepL({ text, targetLang }) {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPL_API_KEY");

  const baseUrl = (process.env.DEEPL_BASE_URL || DEEPL_DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v2/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `DeepL-Auth-Key ${apiKey}`
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`DeepL error (${response.status})`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  const translation = data?.translations?.[0];
  if (!translation?.text) throw new Error("Invalid DeepL response");

  return {
    provider: "deepl",
    translatedText: translation.text,
    detectedSource: translation.detected_source_language || null
  };
}

async function translateWithMagicLoops({ text, targetLang, sourceLang }) {
  const endpoint = process.env.MAGIC_LOOPS_ENDPOINT || MAGIC_LOOPS_DEFAULT_ENDPOINT;
  const apiKey = process.env.MAGIC_LOOPS_API_KEY;

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text,
      targetLanguage: targetLang.toLowerCase(),
      sourceLanguage: sourceLang || undefined
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Magic Loops error (${response.status})`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  const translatedText = data?.translatedText || data?.translation || data?.text || data?.result;
  if (!translatedText) throw new Error("Invalid Magic Loops response");

  return {
    provider: "magicloops",
    translatedText,
    detectedSource: data?.detectedSource || data?.detected_source_language || null
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const targetLang = resolveTargetLang(req.body?.targetLang, req.body?.sourceLang);
    const sourceLang = normalizeLanguageCode(req.body?.sourceLang);

    if (!text) return json(res, 400, { error: "Missing text" });
    if (!targetLang) {
      return json(res, 400, {
        error: "targetLang must be es or it (or provide sourceLang as es/it)"
      });
    }

    try {
      const deeplResult = await translateWithDeepL({ text, targetLang });
      console.log("[translate] provider=deepl");
      return json(res, 200, deeplResult);
    } catch (deepLError) {
      console.warn("[translate] DeepL failed, switching to Magic Loops", {
        status: deepLError?.status || null,
        message: deepLError?.message || "Unknown DeepL error"
      });
      const magicLoopsResult = await translateWithMagicLoops({
        text,
        targetLang,
        sourceLang
      });
      console.log("[translate] provider=magicloops");
      return json(res, 200, magicLoopsResult);
    }
  } catch (error) {
    return json(res, 502, {
      error: "Translation failed",
      detail: error?.message || "Unknown error"
    });
  }
};
