/**
 * Client minimal pour Google Gemini API.
 * Utilisé uniquement côté serveur (Route Handlers) — la clé reste secrète.
 */

// On essaie plusieurs modèles dans l'ordre. Les noms changent régulièrement
// côté Google, et tous ne sont pas dispos pour toutes les clés/régions.
// Le premier qui répond OK est mémorisé pour les requêtes suivantes.
const MODEL_CANDIDATES = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
];
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

let workingModel: string | null = null;

type GeminiPart = { text: string };
type GeminiContent = { role?: "user" | "model"; parts: GeminiPart[] };

type GenerateOptions = {
  /** Force le format de sortie en JSON. Le modèle ne renverra que du JSON valide. */
  json?: boolean;
  temperature?: number;
};

async function callModel(
  model: string,
  body: object,
  apiKey: string,
): Promise<Response> {
  return fetch(`${BASE_URL}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

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

  // Si on a déjà trouvé un modèle qui marche, on le réutilise
  const order = workingModel
    ? [workingModel, ...MODEL_CANDIDATES.filter((m) => m !== workingModel)]
    : MODEL_CANDIDATES;

  let lastError = "";
  for (const model of order) {
    const res = await callModel(model, body, apiKey);
    if (res.ok) {
      workingModel = model;
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Réponse Gemini vide");
      return text.trim();
    }

    const errText = await res.text();
    lastError = `${model} → ${res.status}: ${errText.slice(0, 200)}`;

    // 404 = modèle inconnu, on essaie le suivant
    // 429 = quota, on essaie un autre modèle (peut avoir un quota différent)
    // 400 = peut-être prompt invalide, on essaie quand même un autre modèle
    if (res.status !== 404 && res.status !== 429 && res.status !== 400) {
      // Erreur sérieuse (auth, server) : on s'arrête
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
    }
  }

  throw new Error(
    `Aucun modèle Gemini ne fonctionne. Dernier essai: ${lastError}`,
  );
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const text = await generateText(prompt, { json: true, temperature: 0.4 });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Gemini a renvoyé du JSON invalide: ${text.slice(0, 200)}`);
  }
}
