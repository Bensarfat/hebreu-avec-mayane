-- =====================================================================
-- Mise à jour du 19 octobre 2026 (à exécuter une fois dans SQL Editor)
-- =====================================================================

-- Une seule professeure possible (empêche deux créations simultanées à la première ouverture).
create unique index if not exists one_teacher on public.profiles ((role)) where role = 'teacher';

-- Taille raisonnable des données de progression envoyées par un élève.
alter table public.progress drop constraint if exists progress_size;
alter table public.progress add constraint progress_size
  check (coalesce(pg_column_size(summary), 0) < 300000 and coalesce(pg_column_size(storage), 0) < 3000000);

-- Un élève suspendu ne lit plus sa progression (cohérent avec le contenu).
drop policy if exists "eleve : lit sa progression" on public.progress;
create policy "eleve : lit sa progression" on public.progress for select using (student_id = auth.uid() and public.is_active_student());
