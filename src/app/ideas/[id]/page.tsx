import { IdeaDetailClient } from "@/components/IdeaDetailClient";

// Page client-only : pas de fetch SSR, donc fonctionne offline.
// Le shell HTML est mis en cache par le service worker au premier visit
// et chargé instantanément ensuite.
export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IdeaDetailClient ideaId={id} />;
}
