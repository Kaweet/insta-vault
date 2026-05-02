import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth";
import { generateJson } from "@/lib/gemini";

type Body = {
  /** L'idée à vérifier */
  content: string;
  /** Liste des autres idées du carnet */
  others: { id: string; content: string }[];
};

type GeminiResponse = {
  similar: { id: string; reason: string }[];
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
  const others = (body.others ?? []).filter((o) => o.content?.trim());

  if (!content) {
    return NextResponse.json({ error: "Content requis" }, { status: 400 });
  }
  if (others.length === 0) {
    return NextResponse.json({ similar: [] });
  }

  // Limiter à 50 autres idées max et tronquer chaque contenu pour éviter d'exploser le prompt
  const limited = others.slice(0, 50).map((o) => ({
    id: o.id,
    content: o.content.slice(0, 300),
  }));

  const prompt = `Tu cherches des doublons ou idées très similaires dans un carnet d'idées de posts Instagram.

Idée actuelle :
"""
${content.slice(0, 1500)}
"""

Autres idées du carnet :
${limited.map((o, i) => `[${i + 1}] (id: ${o.id})\n${o.content}`).join("\n\n")}

Identifie les idées qui couvrent un sujet TRÈS PROCHE de l'idée actuelle (même thème, même angle, même message). Sois strict : ne retiens que celles qui pourraient être considérées comme des doublons ou variantes proches, pas juste celles qui partagent un mot-clé.

Réponds UNIQUEMENT avec un objet JSON de la forme :
{
  "similar": [
    { "id": "<id>", "reason": "<courte phrase expliquant la similarité>" }
  ]
}

Si aucune idée n'est vraiment similaire, renvoie une liste vide.`;

  try {
    const result = await generateJson<GeminiResponse>(prompt);
    // Valider que les ids existent bien
    const validIds = new Set(others.map((o) => o.id));
    const filtered = result.similar.filter((s) => validIds.has(s.id));
    return NextResponse.json({ similar: filtered });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur Gemini" },
      { status: 500 },
    );
  }
}
