# Assistente IA (Grade)

## Objetivo

O Assistente IA sugere alternativas para montar/ajustar a grade sem conflitos de professor e sala.

Agora ele também pode **gerar/ completar a grade automaticamente** (por turma), respeitando:

- Turno do professor (pode atender mais de um turno)
- Disponibilidade do professor (dia **e período**)
- Disciplinas, turmas e salas permitidas por professor
- Conflitos já existentes (professor/sala)

Quando existir matriz curricular (tabela `class_subject_requirements`), a geração também tenta **distribuir as aulas sem ultrapassar** a carga semanal por disciplina.

Existem 2 modos:

- **Sugestão** (`/api/ai/schedule`): a IA só sugere, não grava no banco.
- **Geração** (`/api/ai/build-schedule`): a IA propõe e o servidor aplica no banco **somente** o que passar no validador determinístico (sem conflitos).

## Como habilitar

1) Configure o `.env.local` com:

```bash
AI_SCHEDULER_ENABLED=true
OPENAI_API_KEY=... (sua chave)
# opcional
OPENAI_MODEL=gpt-4.1-mini
```

2) Rode o projeto normalmente.

## Endpoint (Sugestão)

`POST /api/ai/schedule`

Payload:

```json
{
  "classId": "...",
  "timeSlotId": "...",
  "subjectId": "... (opcional)",
  "teacherId": "... (opcional)",
  "roomId": "... (opcional)"
}
```

Resposta:

```json
{
  "ok": true,
  "result": {
    "summary": "...",
    "suggestions": [
      {
        "title": "...",
        "type": "PLACE|MOVE|SWAP",
        "proposed": { "timeSlotId": null, "teacherId": null, "roomId": null },
        "reason": "..."
      }
    ],
    "warnings": []
  }
}
```

## Endpoint (Geração)

`POST /api/ai/build-schedule`

Payload:

```json
{
  "classId": "...",
  "overwrite": false
}
```

Resposta:

```json
{
  "ok": true,
  "summary": "...",
  "applied": 10,
  "skipped": [{ "timeSlotId": "...", "reason": "..." }],
  "warnings": []
}
```