-- Colégio Scheduler — Constraints para evitar conflitos de grade
-- Execute este script no Supabase (SQL Editor) no schema public.

-- 1) Uma aula por turma em cada horário
create unique index if not exists schedules_uq_class_time_slot
  on public.schedules (class_id, time_slot_id);

-- 2) Um professor não pode estar em duas turmas no mesmo horário
create unique index if not exists schedules_uq_teacher_time_slot
  on public.schedules (teacher_id, time_slot_id)
  where teacher_id is not null;

-- 3) Uma sala não pode ser usada por duas turmas no mesmo horário
create unique index if not exists schedules_uq_room_time_slot
  on public.schedules (room_id, time_slot_id)
  where room_id is not null;

-- Dica: antes de aplicar, verifique duplicidades existentes:
-- select teacher_id, time_slot_id, count(*) from public.schedules
--  where teacher_id is not null group by 1,2 having count(*) > 1;
