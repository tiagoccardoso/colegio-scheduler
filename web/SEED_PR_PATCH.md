# Patch SEED-PR — Quadro de Aulas

## O que foi incluído

### Banco (Supabase/PostgreSQL)
- `db/seed_pr_upgrade.sql`
  - **3 turnos (6/6/5)**: Manhã e Tarde com 6 períodos; Noite com 5 períodos
  - **33% (20h)**: `teachers.workload_20h_blocks` + `schedules.activity_type` (AULA/HA)
  - **Trigger anti-conflito**:
    - bloqueia **sobreposição de horário** para o mesmo professor (por faixa `starts_at/ends_at`)
    - bloqueia **Noite → Manhã** com menos de **11h** de intervalo
  - **Views**:
    - `vw_seed_pr_teacher_workload_validation` (validação 13 Aulas + 7 HAs por 20h)
    - `vw_director_occupation_map` (mapa geral de ocupação)

### Frontend
- Ajustes no cadastro/geração de horários para respeitar **Noite: 1..5**
- Ajustes na grade de disponibilidade de professores para respeitar **Noite: 1..5**

## Como aplicar

1. **Copie/extraia** este zip na raiz do projeto (sobrescrevendo arquivos).
2. No Supabase (SQL Editor), execute o script:
   - `db/seed_pr_upgrade.sql`

## Observações
- Os índices únicos de conflito por `time_slot_id` (script `db/schedules_constraints.sql`) continuam recomendados.
- Para usar HA na prática, basta inserir linhas em `schedules` com:
  - `activity_type = 'HA'`
  - `teacher_id` e `time_slot_id` preenchidos
  - `class_id` e `subject_id` **nulos**
