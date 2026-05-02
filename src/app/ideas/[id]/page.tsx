import { IdeaDetailClient } from "@/components/IdeaDetailClient";

// Page client-only. Le composant lit son id via useParams() au runtime,
// donc le HTML rendu est identique pour toutes les /ideas/[id] et peut
// servir de fallback offline pour les pages jamais visitées.
export default function IdeaDetailPage() {
  return <IdeaDetailClient />;
}
