import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth";

/**
 * Debug : liste les modèles Gemini disponibles pour la clé courante.
 * Permet de diagnostiquer les erreurs 404 "model not found".
 * Visite /api/ai/models pour voir le résultat.
 */
export async function GET() {
  try {
    await requireAllowedUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY non configurée" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { cache: "no-store" },
    );
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `HTTP ${res.status}`, body: text.slice(0, 1000) },
        { status: res.status },
      );
    }
    const json = JSON.parse(text) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    // On filtre ceux qui supportent generateContent
    const compatible = (json.models ?? [])
      .filter((m) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m) => m.name);
    return NextResponse.json({ models: compatible });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur" },
      { status: 500 },
    );
  }
}
