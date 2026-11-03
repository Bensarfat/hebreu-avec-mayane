-- =====================================================================
-- Mails « nouveau cours » aux élèves (3 nov. 2026)
-- Appliqué automatiquement à la fusion (action « Mettre à jour la base »). Peut être relancé sans risque.
-- =====================================================================
-- notify_docs : l'élève reçoit un mail quand un nouveau cours est ajouté (activé par défaut ; l'élève ou Maayane peut le couper)
-- notified_at : date du dernier mail (pas plus d'un mail toutes les 10 minutes)
-- notify_token : identifiant secret du lien « ne plus recevoir ces mails »
alter table public.profiles add column if not exists notify_docs  boolean not null default true;
alter table public.profiles add column if not exists notified_at  timestamptz;
alter table public.profiles add column if not exists notify_token uuid not null default gen_random_uuid();
-- l'élève lit ces colonnes avec son profil (règle existante) ; il ne les modifie que par le serveur (/api/notify)
