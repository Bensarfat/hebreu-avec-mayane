-- =====================================================================
-- Agenda : réservation des cours (20 oct. 2026)
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.
-- =====================================================================
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
