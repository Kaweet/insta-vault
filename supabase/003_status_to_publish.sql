-- ============================================================
-- Migration : ajouter la valeur 'to_publish' à l'enum idea_status
-- ============================================================
-- À exécuter dans Supabase SQL Editor.
-- Idempotent : ré-exécutable sans casse.
-- ============================================================

alter type insta_vault.idea_status add value if not exists 'to_publish' before 'published';
