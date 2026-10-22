-- =====================================================================
-- Messages : questions des élèves à Maayane et réponses (23 oct. 2026)
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.
-- =====================================================================
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  from_role   text not null check (from_role in ('student', 'teacher')),
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists messages_student on public.messages (student_id, created_at);

alter table public.messages enable row level security;
drop policy if exists "prof : tout" on public.messages;
drop policy if exists "eleve : lit ses messages" on public.messages;
drop policy if exists "eleve : ecrit une question" on public.messages;
create policy "prof : tout" on public.messages for all using (public.is_teacher()) with check (public.is_teacher());
-- l'élève lit sa conversation et n'écrit que des questions, en son nom
create policy "eleve : lit ses messages"   on public.messages for select using (student_id = auth.uid() and public.is_active_student());
create policy "eleve : ecrit une question" on public.messages for insert with check (student_id = auth.uid() and from_role = 'student' and read_at is null and public.is_active_student());
