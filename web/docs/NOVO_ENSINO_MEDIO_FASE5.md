# Novo Ensino Médio — Fase 5

Esta etapa fecha três lacunas importantes de conformidade:

1. validação automática da carga curricular efetiva;
2. validação dos componentes obrigatórios da FGB com override por rede/UF;
3. alinhamento com currículo estadual específico, com campos próprios na régua da escola.

## Patch SQL

Execute após as fases anteriores:

- `db/patch_novo_ensino_medio.sql`
- `db/patch_novo_ensino_medio_fase2.sql`
- `db/patch_novo_ensino_medio_fase3.sql`
- `db/patch_novo_ensino_medio_fase4.sql`
- `db/patch_novo_ensino_medio_fase5.sql`

## O que muda

A tabela `school_curriculum_settings` passa a guardar:

- UF da escola/rede;
- nome e versão do currículo estadual adotado;
- URL de referência normativa;
- observações de alinhamento;
- overrides estaduais para carga total, FGB, itinerário e mínimo de itinerários;
- lista customizável de componentes obrigatórios da FGB;
- obrigatoriedade configurável de educação digital e Projeto de Vida.

## Efeito no sistema

O painel `/director/novo-ensino-medio` passa a mostrar:

- régua federal x régua efetiva da rede;
- validação automática por turma;
- validação da oferta mínima de itinerários da escola;
- rastreio explícito do currículo estadual adotado.
