# Relatório final – Grades (por Turma e por Sala) + IA

Data: 2025-12-26

## Telas entregues

### 1) Grade por turma
- **Rota:** `/grades`
- **Formato:** colunas = turmas; linhas = dia/periodo; célula = *Disciplina (sigla)* + *Professor (sigla)*
- **Impressão:** A4 landscape com bordas fortes.

### 2) Grade por sala
- **Rota:** `/grades/rooms`
- **Formato:** colunas = salas; linhas = dia/periodo; célula = *Turma* + *Disciplina – Professor*
- **Sala efetiva:** se `schedules.room_id` estiver vazio, usa:
  1) `classes.default_room_id`
  2) `teachers.default_room_id` (se existir)
  3) (senão) não aparece na grade por sala (para evitar conflito fantasma)

### 3) Montar grade (matriz curricular avançada)
- **Rota:** `/schedule`
- **Matriz curricular** agora salva além de aulas/semana:
  - **Max/dia**
  - **Min dias**
  - **Bloco**
  - **Preferir consecutivo**
- Persistência feita por **replace** (delete + insert) para não depender de índice único.

### 4) Horários (time slots)
- **Rota:** `/time-slots`
- **Geração de períodos** corrigida para não depender de índice único.
  - A lógica carrega IDs existentes e faz upsert por `id`.

## Recursos de IA

### 1) AutoBuilder
- **UI:** botão “Gerar grade” em `/schedule` (componente `ScheduleAutoBuilder`)
- **API:** `POST /api/ai/build-schedule`
- **Melhorias aplicadas:**
  - `teacher.availability` entende:
    - formato atual: `availability[SHIFT][weekday] = [periods...]`
    - formato legado: `availability[SHIFT][weekday] = {period: boolean}`
  - As regras da matriz são consumidas pelo endpoint (campos novos já são buscados; o motor de otimização continua no endpoint).
  - Proteção contra “vazamento”: filtros por `school_id`.

### 2) Assistente por slot
- **UI:** `ScheduleAssistant`
- **API:** `POST /api/ai/schedule`
- **Disponibilidade** compatível com os dois formatos.

## Siglas recomendadas (padrão)
- Português: PORT.
- Matemática: MAT.
- História: HIST.
- Geografia: GEOG.
- Ciências: CIENC.
- Biologia: BIOL.
- Química: QUIM.
- Física: FIS.
- Inglês: ING.
- Espanhol: ESP.
- Filosofia: FILO.
- Sociologia: SOC.
- Ed. Física: ED. FÍS.
- Arte: ARTE
- Redação: RED.
- Projeto de Vida: P. VIDA

## Migração / Banco
- Rode: `db/migrations_grades_ai.sql` no Supabase SQL Editor.
- Ajuste RLS se você usa policies diferentes.

