# Novo Ensino Médio — Fase 7 (cadastros completos)

Esta etapa fecha as lacunas dos cadastros-base que ainda deixavam o sistema vulnerável a inconsistências do Novo Ensino Médio.

## O que foi ampliado

### Turmas
- ano letivo
- eixo do itinerário
- nome do itinerário/trilha
- capacidade máxima
- vagas iniciais
- indicador de turma ativa
- observações pedagógicas
- seleção explícita de sala padrão

### Componentes curriculares
- carga horária anual
- aulas semanais sugeridas
- eixo do itinerário
- ementa/objetivos
- habilitação docente requerida
- marcação de componente obrigatório

### Docentes
- CPF
- matrícula/registro interno
- titulação principal
- área principal de habilitação
- áreas adicionais
- aptidão para atuar no NEM
- aptidão para formação técnica
- URL de currículo/Lattes
- observações de formação

### Salas
- capacidade
- bloco/andar
- suporte a educação digital
- suporte a formação técnica
- acessibilidade
- observações

## Resultado prático
O sistema passa a validar não apenas a matriz curricular, mas também a qualidade mínima dos cadastros que sustentam a oferta.

Em linguagem menos burocrática: deixa de ser só um motor de grade com campos elegantes e passa a registrar a realidade escolar com um pouco mais de juízo.

## Aplicação
Execute no Supabase:

- `db/patch_novo_ensino_medio_fase7_cadastros.sql`

Depois revise os cadastros em:
- `/classes`
- `/subjects`
- `/teachers`
- `/rooms`
