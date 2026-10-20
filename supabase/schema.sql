-- =====================================================================
-- Hébreu avec Mayane — base de données Supabase
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».
-- Peut être relancé sans risque (il ne recrée que ce qui manque).
-- =====================================================================

-- Comptes (professeure et élèves). L'identifiant de connexion est relié
-- à un compte Supabase Auth (e-mail technique <login>@hebreu-avec-mayane.app).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('teacher', 'student', 'admin')),   -- admin : mêmes droits que la professeure
  login       text not null unique,
  first       text not null default '',
  last        text not null default '',
  email       text not null default '',
  phone       text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Mot de passe des élèves, consultable par la professeure uniquement.
create table if not exists public.student_secrets (
  student_id  uuid primary key references public.profiles (id) on delete cascade,
  pw          text not null default ''
);

-- Contenu du site de chaque élève (vocabulaire, grammaire… issus des documents).
create table if not exists public.contents (
  student_id  uuid primary key references public.profiles (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Progression de chaque élève (réponses, XP, badges) et résumé pour le tableau de bord.
create table if not exists public.progress (
  student_id  uuid primary key references public.profiles (id) on delete cascade,
  storage     jsonb,
  summary     jsonb,
  updated_at  timestamptz not null default now()
);

-- Documents déposés par la professeure (le fichier lui-même est dans Storage).
create table if not exists public.docs (
  id             text primary key,
  name           text not null,
  type           text not null default '',
  size           bigint not null default 0,
  path           text not null,
  students       uuid[] not null default '{}',
  status         text not null default 'pending',
  result         jsonb,
  summary        text,
  error          text,
  added_at       timestamptz not null default now(),
  integrated_at  timestamptz
);

-- Réglages du site (une seule ligne).
create table if not exists public.settings (
  id    int primary key default 1 check (id = 1),
  data  jsonb not null default '{}'::jsonb
);
insert into public.settings (id) values (1) on conflict do nothing;

-- Une seule professeure ; taille raisonnable des progressions.
create unique index if not exists one_teacher on public.profiles ((role)) where role = 'teacher';
alter table public.progress drop constraint if exists progress_size;
alter table public.progress add constraint progress_size
  check (coalesce(pg_column_size(summary), 0) < 300000 and coalesce(pg_column_size(storage), 0) < 3000000);

-- ---------------------------------------------------------------------
-- Droits d'accès (Row Level Security)
-- ---------------------------------------------------------------------
create or replace function public.is_teacher() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'));
$$;

create or replace function public.is_active_student() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'student' and active);
$$;

alter table public.profiles        enable row level security;
alter table public.student_secrets enable row level security;
alter table public.contents        enable row level security;
alter table public.progress        enable row level security;
alter table public.docs            enable row level security;
alter table public.settings        enable row level security;

drop policy if exists "prof : tout" on public.profiles;
drop policy if exists "eleve : son profil" on public.profiles;
create policy "prof : tout"        on public.profiles for all    using (public.is_teacher()) with check (public.is_teacher());
create policy "eleve : son profil" on public.profiles for select using (id = auth.uid());

drop policy if exists "prof : tout" on public.student_secrets;
create policy "prof : tout" on public.student_secrets for all using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "prof : tout" on public.contents;
drop policy if exists "eleve : son contenu" on public.contents;
create policy "prof : tout"         on public.contents for all    using (public.is_teacher()) with check (public.is_teacher());
create policy "eleve : son contenu" on public.contents for select using (student_id = auth.uid() and public.is_active_student());

drop policy if exists "prof : tout" on public.progress;
drop policy if exists "eleve : lit sa progression" on public.progress;
drop policy if exists "eleve : cree sa progression" on public.progress;
drop policy if exists "eleve : met a jour sa progression" on public.progress;
create policy "prof : tout"                      on public.progress for all    using (public.is_teacher()) with check (public.is_teacher());
create policy "eleve : lit sa progression"       on public.progress for select using (student_id = auth.uid() and public.is_active_student());
create policy "eleve : cree sa progression"      on public.progress for insert with check (student_id = auth.uid() and public.is_active_student());
create policy "eleve : met a jour sa progression" on public.progress for update using (student_id = auth.uid() and public.is_active_student()) with check (student_id = auth.uid());

drop policy if exists "prof : tout" on public.docs;
create policy "prof : tout" on public.docs for all using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "prof : tout" on public.settings;
create policy "prof : tout" on public.settings for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------------------------------------------------------------------
-- Agenda : réservation des cours
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles (id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        text not null default 'booked' check (status in ('booked', 'cancelled')),
  note          text not null default '' check (char_length(note) <= 500),
  created_by    text not null default 'student' check (created_by in ('student', 'teacher')),
  cancelled_by  text check (cancelled_by in ('student', 'teacher')),
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  constraint bookings_time check (ends_at > starts_at and ends_at - starts_at <= interval '8 hours'),
  -- deux cours ne peuvent jamais se chevaucher (même si deux élèves réservent au même instant)
  constraint bookings_no_overlap exclude using gist (tstzrange(starts_at, ends_at) with &&) where (status = 'booked')
);
create index if not exists bookings_student on public.bookings (student_id, starts_at);

alter table public.bookings enable row level security;
drop policy if exists "prof : tout" on public.bookings;
drop policy if exists "eleve : ses cours" on public.bookings;
create policy "prof : tout"       on public.bookings for all    using (public.is_teacher()) with check (public.is_teacher());
-- les élèves lisent leurs propres cours ; ils réservent et annulent via le serveur (/api/agenda), qui vérifie tout
create policy "eleve : ses cours" on public.bookings for select using (student_id = auth.uid() and public.is_active_student());

-- ---------------------------------------------------------------------
-- Stockage des documents (privé, professeure uniquement)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

drop policy if exists "documents : prof" on storage.objects;
create policy "documents : prof" on storage.objects for all
  using (bucket_id = 'documents' and public.is_teacher())
  with check (bucket_id = 'documents' and public.is_teacher());
