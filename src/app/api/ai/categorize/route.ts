import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth";
import { generateJson } from "@/lib/gemini";

type Body = {
  content: string;
  categories: { id: string; name: string }[];
};

type GeminiResponse = {
  category_id: string | null;
  reason: string;
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
  const categories = body.categories ?? [];

  if (!content) {
    return NextResponse.json({ error: "Content requis" }, { status: 400 });
  }
  if (categories.length === 0) {
    return NextResponse.json(
      { error: "Aucune catégorie disponible" },
      { status: 400 },
    );
  }

  const prompt = `Tu es un assistant qui catégorise des idées de posts Instagram pour une créatrice de contenu.

Voici les catégories existantes :
${categories.map((c) => `- ${c.name} (id: ${c.id})`).join("\n")}

Voici l'idée à catégoriser :
"""
${content.slice(0, 2000)}
"""

Choisis la catégorie la plus pertinente parmi celles ci-dessus. Si aucune ne convient vraiment, renvoie null.

Réponds UNIQUEMENT avec un objet JSON de la forme :
{
  "category_id": "<id de la catégorie ou null>",
  "reason": "<courte phrase expliquant ton choix>"
}`;

  try {
    const result = await generateJson<GeminiResponse>(prompt);
    // Valider que la category_id existe bien
    if (
      result.category_id &&
      !categories.some((c) => c.id === result.category_id)
    ) {
      return NextResponse.json(
        { category_id: null, reason: "Catégorie non reconnue" },
        { status: 200 },
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur Gemini" },
      { status: 500 },
    );
  }
}
