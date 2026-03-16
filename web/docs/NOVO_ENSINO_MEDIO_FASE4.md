# Fase 4 — documentos oficiais e emissão formal

Esta etapa adiciona ao projeto:

- `school_document_settings` para cabeçalho institucional, rede, cidade/UF e signatários;
- `student_document_issues` para rastrear emissões, reimpressões e segundas vias;
- tela da direção para configurar o layout institucional;
- tela de emissão para histórico do NEM, declarações, boletim sintético e certificado de trilha técnica;
- visualização individual pronta para impressão.

## Ordem de aplicação

1. `db/patch_novo_ensino_medio.sql`
2. `db/patch_novo_ensino_medio_fase2.sql`
3. `db/patch_novo_ensino_medio_fase3.sql`
4. `db/patch_novo_ensino_medio_fase4.sql`

## Rotas novas

- `/director/documentos-nem`
- `/students/documentos`
- `/students/documentos/[issueId]`

## Objetivo

Fechar o ciclo documental do Novo Ensino Médio sem depender de planilha paralela, Word perdido em pasta de rede ou rituais administrativos com cheiro de desespero.
