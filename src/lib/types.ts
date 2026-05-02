export type IdeaStatus = "draft" | "preparing" | "published";
export type TranscriptionSource = "text" | "audio";
export type MediaKind = "audio" | "photo" | "link";

export type Idea = {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  transcription_source: TranscriptionSource;
  category_id: string | null;
  status: IdeaStatus;
  ai_caption: string | null;
  ai_hashtags: string[] | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type Media = {
  id: string;
  idea_id: string;
  user_id: string;
  kind: MediaKind;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  duration_ms: number | null;
  created_at: string;
};
