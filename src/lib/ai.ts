"use client";

export type RewriteResult = {
  title: string;
  caption: string;
  hashtags: string[];
};

export type CategorizeResult = {
  category_id: string | null;
  reason: string;
};

export type DuplicatesResult = {
  similar: { id: string; reason: string }[];
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) msg = json.error;
    } catch {
      msg = text || msg;
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function aiRewrite(content: string): Promise<RewriteResult> {
  return postJson("/api/ai/rewrite", { content });
}

export function aiCategorize(
  content: string,
  categories: { id: string; name: string }[],
): Promise<CategorizeResult> {
  return postJson("/api/ai/categorize", { content, categories });
}

export function aiFindDuplicates(
  content: string,
  others: { id: string; content: string }[],
): Promise<DuplicatesResult> {
  return postJson("/api/ai/duplicates", { content, others });
}
