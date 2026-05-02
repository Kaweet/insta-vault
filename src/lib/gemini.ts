/**
 * Client minimal pour Google Gemini API.
 * Utilisé uniquement côté serveur (Route Handlers) — la clé reste secrète.
 */

const MODEL = "gemini-2.0-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart = { text: string };
type GeminiContent = { role?: "user" | "model"; parts: GeminiPart[] };

type GenerateOptions = {
  /** Force le format de sortie en JSON. Le modèle ne renverra que du JSON valide. */
  json?: boolean;
  temperature?: number;
};

export async function generateText(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY non configurée. Ajoute-la dans Vercel → Settings → Environment Variables.",
    );
  }

  const body: {
    contents: GeminiContent[];
    generationConfig?: Record<string, unknown>;
  } = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  if (opts.json || opts.temperature !== undefined) {
    body.generationConfig = {};
    if (opts.json) {
      body.generationConfig.responseMimeType = "application/json";
    }
    if (opts.temperature !== undefined) {
      body.generationConfig.temperature = opts.temperature;
    }
  }

  const res = await fetch(
    `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Pas de cache : chaque réponse doit être fraîche
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Gemini API ${res.status}: ${errText.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Réponse Gemini vide");
  }
  return text.trim();
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const text = await generateText(prompt, { json: true, temperature: 0.4 });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Gemini a renvoyé du JSON invalide: ${text.slice(0, 200)}`);
  }
}
