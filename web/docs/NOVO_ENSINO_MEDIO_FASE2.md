# Novo Ensino Médio — Fase 2

Esta etapa adiciona a camada de trajetória estudantil ao sistema.

## Novas rotas
- `/students` — cadastro do estudante com matrícula inicial, coorte, itinerário e Projeto de Vida.
- `/students/acompanhamento` — frequência, avaliação com evidências e alertas pedagógicos.
- `/director/permanencia` — painel executivo de permanência, risco e desempenho.

## Novas tabelas
- `students`
- `student_enrollments`
- `student_attendance_records`
- `student_assessment_records`
- `student_risk_alerts`

## Ordem sugerida de implantação
1. Aplicar `db/patch_novo_ensino_medio_fase2.sql`.
2. Validar RLS para os perfis da escola.
3. Publicar as novas rotas.
4. Treinar equipe pedagógica para uso de frequência, avaliação e alertas.
5. Só depois amarrar histórico escolar e relatórios oficiais por coorte.

## Observação
Esta fase não substitui a etapa estrutural-curricular anterior. Ela complementa a adaptação trazendo o ciclo pedagógico do estudante.
