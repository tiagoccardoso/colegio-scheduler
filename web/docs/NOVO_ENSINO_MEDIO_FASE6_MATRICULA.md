# Novo Ensino Médio — Fase 6

Esta etapa completa o cadastro do estudante para fins de matrícula e secretaria escolar.

## O que foi adicionado

- ampliação da tabela `students` com dados pessoais, endereço, saúde, filiação, benefícios e escola de origem;
- campo `enrollment_date` em `student_enrollments`;
- tabela `student_guardians` para múltiplos responsáveis;
- tabela `student_document_files` para anexos de documentos;
- bucket privado `student-documents` com políticas para equipe ativa da escola;
- tela `/students` ampliada com:
  - cadastro completo do estudante;
  - manutenção de responsáveis;
  - anexos de documentos da matrícula.

## Patch SQL

Rode no Supabase, após os patches anteriores do NEM:

- `db/patch_novo_ensino_medio_fase6_matricula_completa.sql`

## Observação funcional

Os documentos são anexados após o salvamento inicial do estudante, porque o storage precisa do `student_id` para organizar o caminho do arquivo.
