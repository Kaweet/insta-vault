-- ============================================================
-- Migration : ajouter hook + caption sur insta_vault.ideas
-- ============================================================
-- À exécuter dans Supabase SQL Editor.
-- Idempotent : peut être ré-exécuté sans casse.
-- ============================================================

alter table insta_vault.ideas
  add column if not exists hook text,
  add column if not exists caption text;

-- Pas de backfill : le `content` existant reste dans `content`,
-- les nouveaux champs `hook` et `caption` sont vides pour les idées
-- déjà créées. Mathilde les remplira au fur et à mesure.
