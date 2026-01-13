# Banco de dados

## Evitar conflitos de grade

Rode o script `schedules_constraints.sql` no Supabase (SQL Editor). Ele cria índices únicos que impedem:

- **2 aulas na mesma turma** no mesmo horário
- **1 professor em duas turmas** no mesmo horário
- **1 sala ocupada por duas turmas** no mesmo horário

Mesmo com validação no servidor, esses índices são a proteção final contra concorrência.

## Adequação SEED-PR (6/6/5 + 33% HA + descanso 11h)

Rode o script `seed_pr_upgrade.sql` para adicionar:

- Regra de períodos por turno (**Manhã/Tarde: 6**, **Noite: 5**) em `time_slots`
- `activity_type` em `schedules` para suportar **AULA** e **HA**
- Campo `workload_20h_blocks` em `teachers` + view de validação **13 Aulas + 7 HAs**
- Trigger anti-conflito por **sobreposição de horário** + regra de **11h** entre **Noite → Manhã**
- View `vw_director_occupation_map` (mapa geral de ocupação)

## Professores — campos extras

Rode o script `teachers_fields.sql` para adicionar:

- `subject_ids`, `class_ids`, `room_ids`
- `restrictions`
- `available_weekdays`

Esses campos alimentam o filtro de professores/salas e a geração automática da grade.

## Matriz curricular por turma

Rode o script `class_subject_requirements.sql` para criar a tabela `class_subject_requirements`
(**disciplina + aulas/semana por turma**).

Quando houver matriz configurada para uma turma, a geração automática passa a:

- priorizar cumprir a carga semanal por disciplina
- não exceder a quantidade definida por disciplina
- manter o validador anti-conflito (professor/sala) como “última barreira”

## Intervalo por turno (Horários)

Rode o script `shift_settings.sql` para criar a tabela `shift_settings`, que guarda o **intervalo (minutos)** entre períodos por **turno**.

A tela **Horários** pode usar esse valor durante a geração automática do calendário.
