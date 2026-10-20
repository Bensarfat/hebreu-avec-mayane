-- =====================================================================
-- Compte administrateur (20 oct. 2026) : mêmes droits que la professeure,
-- n'apparaît pas dans la liste des élèves. Peut être relancé sans risque.
-- =====================================================================
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%role%' loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('teacher', 'student', 'admin'));

create or replace function public.is_teacher() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'));
$$;

-- Pour donner le rôle administrateur à un compte créé dans Authentication > Users
-- (adresse <identifiant>@hebreu-avec-mayane.app) :
-- insert into public.profiles (id, role, login, first, last)
--   select id, 'admin', 'ben', 'Benjamin', 'Sarfati' from auth.users where email = 'ben@hebreu-avec-mayane.app'
--   on conflict (id) do update set role = 'admin';
