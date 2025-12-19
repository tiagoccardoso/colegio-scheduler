# Banco de dados

## Evitar conflitos de grade

Rode o script `schedules_constraints.sql` no Supabase (SQL Editor). Ele cria índices únicos que impedem:

- **2 aulas na mesma turma** no mesmo horário
- **1 professor em duas turmas** no mesmo horário
- **1 sala ocupada por duas turmas** no mesmo horário

Mesmo com validação no servidor, esses índices são a proteção final contra concorrência.
