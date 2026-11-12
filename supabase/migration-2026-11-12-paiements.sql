-- =====================================================================
-- Paiements et lien Zoom (12 nov. 2026)
-- Appliqué automatiquement à la fusion (action « Mettre à jour la base »). Peut être relancé sans risque.
-- =====================================================================
-- rate : prix de l'heure de l'élève (vide = pas de suivi des paiements)
-- billing_start : les cours de l'agenda sont comptés à partir de cette date
-- zoom_url : lien Zoom propre à l'élève (vide = lien commun des Réglages)
alter table public.profiles add column if not exists rate          numeric(10,2);
alter table public.profiles add column if not exists billing_start date;
alter table public.profiles add column if not exists zoom_url      text not null default '';

-- paiements reçus (kind = 'payment') et cours hors agenda à payer (kind = 'charge')
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  kind        text not null default 'payment' check (kind in ('payment', 'charge')),
  amount      numeric(10,2) not null check (amount > 0 and amount < 1000000),
  paid_on     date not null default current_date,
  method      text not null default '' check (char_length(method) <= 40),
  note        text not null default '' check (char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists payments_student on public.payments (student_id, paid_on);

-- la professeure gère tout ; l'élève consulte son compte par le serveur (/api/compte), jamais directement
alter table public.payments enable row level security;
drop policy if exists "prof : tout" on public.payments;
create policy "prof : tout" on public.payments for all using (public.is_teacher()) with check (public.is_teacher());
