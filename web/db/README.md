# Banco de dados

## Cadastro (Onboarding) — RLS de `profiles`

Se ao concluir o cadastro aparecer o erro:

> `new row violates row-level security policy for table "profiles"`

rode o script `patch_profiles_rls.sql` no Supabase (SQL Editor). Ele cria as policies
necessárias para o usuário autenticado **inserir/ler/atualizar** o próprio perfil.

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

## Equipe pedagógica (acessos)

Rode o script `pedagogical_team.sql` para criar a tabela `public.pedagogical_team`.

Essa tabela guarda, por escola, a lista de usuários cadastrados como **equipe pedagógica** (user_id + school_id + nome),
com RLS permitindo que **diretores** gerenciem a equipe. A autorização de acesso no app continua baseada em `public.profiles.role`
(com valor `pedagogical`).

## Equipe pedagógica — liberar role em `profiles`

Se ao cadastrar um usuário na tela **Equipe pedagógica** aparecer o erro:

> `new row for relation "profiles" violates check constraint "profiles_role_check"`

rode o script `patch_profiles_role_check.sql` no Supabase (SQL Editor).
Ele atualiza a constraint/enum de `public.profiles.role` para aceitar o valor `pedagogical`.

