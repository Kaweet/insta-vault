-- ============================================================
-- INSTA VAULT — Schéma initial
-- ============================================================
-- À exécuter dans Supabase SQL Editor (projet cwtffczpvurvxuilexhx)
-- Idempotent : peut être ré-exécuté sans casser l'existant.
-- ============================================================

-- 1. Schéma dédié pour isoler de tes autres apps Supabase
create schema if not exists insta_vault;

-- Permettre aux clients PostgREST (anon, authenticated) de "voir" le schéma.
-- Les permissions fines sont gérées par RLS, pas par GRANT.
grant usage on schema insta_vault to anon, authenticated;
grant all on all tables in schema insta_vault to anon, authenticated;
grant all on all sequences in schema insta_vault to anon, authenticated;
grant all on all functions in schema insta_vault to anon, authenticated;

alter default privileges in schema insta_vault
  grant all on tables to anon, authenticated;
alter default privileges in schema insta_vault
  grant all on sequences to anon, authenticated;
alter default privileges in schema insta_vault
  grant all on functions to anon, authenticated;

-- 2. Whitelist d'emails autorisés
create table if not exists insta_vault.allowed_emails (
  email text primary key,
  added_at timestamptz not null default now()
);

insert into insta_vault.allowed_emails (email) values
  ('mgory.pro@gmail.com'),
  ('kevinhougue@gmail.com')
on conflict (email) do nothing;

-- 3. Helper : vérifier que le user courant fait partie de la whitelist
create or replace function insta_vault.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = insta_vault, public
as $$
  select exists (
    select 1
    from insta_vault.allowed_emails ae
    where ae.email = (auth.jwt() ->> 'email')
  );
$$;

-- 4. Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'idea_status') then
    create type insta_vault.idea_status as enum ('draft', 'preparing', 'to_publish', 'published');
  end if;
  if not exists (select 1 from pg_type where typname = 'transcription_source') then
    create type insta_vault.transcription_source as enum ('text', 'audio');
  end if;
  if not exists (select 1 from pg_type where typname = 'media_kind') then
    create type insta_vault.media_kind as enum ('audio', 'photo', 'link');
  end if;
end$$;

-- 5. Catégories (créées par les utilisateurs)
create table if not exists insta_vault.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx on insta_vault.categories(user_id);

-- 6. Idées
create table if not exists insta_vault.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  content text not null default '',
  transcription_source insta_vault.transcription_source not null default 'text',
  category_id uuid references insta_vault.categories(id) on delete set null,
  status insta_vault.idea_status not null default 'draft',
  ai_caption text,
  ai_hashtags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ideas_user_id_idx on insta_vault.ideas(user_id);
create index if not exists ideas_category_id_idx on insta_vault.ideas(category_id);
create index if not exists ideas_status_idx on insta_vault.ideas(status);
create index if not exists ideas_created_at_idx on insta_vault.ideas(created_at desc);

-- 7. Médias (audio en V1, photo/link en V2)
create table if not exists insta_vault.media (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references insta_vault.ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind insta_vault.media_kind not null,
  storage_path text,
  external_url text,
  mime_type text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists media_idea_id_idx on insta_vault.media(idea_id);
create index if not exists media_user_id_idx on insta_vault.media(user_id);

-- 8. Trigger : auto-update updated_at
create or replace function insta_vault.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ideas_set_updated_at on insta_vault.ideas;
create trigger ideas_set_updated_at
  before update on insta_vault.ideas
  for each row execute function insta_vault.tg_set_updated_at();

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================
-- Politique : tout user dont l'email est dans allowed_emails peut tout faire
-- sur ideas / categories / media. Pas de séparation par user_id (carnet partagé).
-- ============================================================

alter table insta_vault.allowed_emails enable row level security;
alter table insta_vault.categories     enable row level security;
alter table insta_vault.ideas          enable row level security;
alter table insta_vault.media          enable row level security;

-- allowed_emails : lecture seule pour les users authentifiés (pour debug/UI)
drop policy if exists "allowed_emails_select" on insta_vault.allowed_emails;
create policy "allowed_emails_select"
  on insta_vault.allowed_emails
  for select
  to authenticated
  using (insta_vault.is_allowed_user());

-- categories : tout (CRUD) si whitelisted
drop policy if exists "categories_all" on insta_vault.categories;
create policy "categories_all"
  on insta_vault.categories
  for all
  to authenticated
  using (insta_vault.is_allowed_user())
  with check (insta_vault.is_allowed_user());

-- ideas : tout (CRUD) si whitelisted
drop policy if exists "ideas_all" on insta_vault.ideas;
create policy "ideas_all"
  on insta_vault.ideas
  for all
  to authenticated
  using (insta_vault.is_allowed_user())
  with check (insta_vault.is_allowed_user());

-- media : tout (CRUD) si whitelisted
drop policy if exists "media_all" on insta_vault.media;
create policy "media_all"
  on insta_vault.media
  for all
  to authenticated
  using (insta_vault.is_allowed_user())
  with check (insta_vault.is_allowed_user());

-- ============================================================
-- 10. STORAGE — bucket audio
-- ============================================================
-- Bucket privé pour les enregistrements audio. Accès via RLS uniquement.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'insta-vault-audio',
  'insta-vault-audio',
  false,
  10 * 1024 * 1024, -- 10 MB max par fichier
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS sur storage.objects : seuls les whitelisted accèdent au bucket
drop policy if exists "insta_vault_audio_select" on storage.objects;
create policy "insta_vault_audio_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'insta-vault-audio'
    and insta_vault.is_allowed_user()
  );

drop policy if exists "insta_vault_audio_insert" on storage.objects;
create policy "insta_vault_audio_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'insta-vault-audio'
    and insta_vault.is_allowed_user()
  );

drop policy if exists "insta_vault_audio_update" on storage.objects;
create policy "insta_vault_audio_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'insta-vault-audio'
    and insta_vault.is_allowed_user()
  );

drop policy if exists "insta_vault_audio_delete" on storage.objects;
create policy "insta_vault_audio_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'insta-vault-audio'
    and insta_vault.is_allowed_user()
  );

-- ============================================================
-- DONE
-- ============================================================
-- Pour vérifier rapidement après exécution :
-- select * from insta_vault.allowed_emails;
-- select schema_name from information_schema.schemata where schema_name = 'insta_vault';
-- ============================================================
