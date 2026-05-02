import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth";
import { generateJson } from "@/lib/gemini";

type Body = {
  content: string;
  /** Optional: tone/style hint */
  style?: string;
};

type GeminiResponse = {
  title: string;
  caption: string;
  hashtags: string[];
};

export async function POST(req: Request) {
  try {
    await requireAllowedUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "Content requis" }, { status: 400 });
  }

  const styleHint = body.style?.trim()
    ? `\n\nStyle souhaité : ${body.style.trim()}`
    : "";

  const prompt = `Tu es une assistante qui aide une créatrice de contenu Instagram à transformer ses idées brutes en posts publiables.

Voici l'idée brute :
"""
${content.slice(0, 3000)}
"""${styleHint}

Génère :
1. Un titre court (max 60 caractères) qui résume l'idée
2. Une caption Instagram engageante en français (3 à 6 lignes, peut inclure des emojis pertinents, un appel à l'action ou une question à la fin)
3. 8 à 12 hashtags pertinents en français/anglais (sans le #, juste le mot)

Reste fidèle au sens et au ton de l'idée brute. N'invente pas de faits qui ne sont pas dans l'idée.

Réponds UNIQUEMENT avec un objet JSON de la forme :
{
  "title": "<titre>",
  "caption": "<caption complète>",
  "hashtags": ["hashtag1", "hashtag2", ...]
}`;

  try {
    const result = await generateJson<GeminiResponse>(prompt);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur Gemini" },
      { status: 500 },
    );
  }
}
