-- Campo CGM (Código Geral de Matrícula) no cadastro de estudantes

alter table if exists public.students
  add column if not exists cgm text null;

create index if not exists students_school_cgm_idx
  on public.students (school_id, cgm)
  where cgm is not null and btrim(cgm) <> '';
