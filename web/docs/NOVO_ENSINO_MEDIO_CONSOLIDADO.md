# Pacote consolidado — Novo Ensino Médio

Este pacote reúne as quatro etapas implementadas no projeto:

1. **Fase 1** — classificação curricular, coortes, modelos de oferta e painel de conformidade;
2. **Fase 2** — estudantes, matrículas, acompanhamento pedagógico e permanência;
3. **Fase 3** — histórico escolar consolidado, trilhas técnicas e relatórios por coorte;
4. **Fase 4** — emissão formal de documentos, layout institucional e rastreio das declarações/históricos.

## Ordem dos patches SQL

1. `db/patch_novo_ensino_medio.sql`
2. `db/patch_novo_ensino_medio_fase2.sql`
3. `db/patch_novo_ensino_medio_fase3.sql`
4. `db/patch_novo_ensino_medio_fase4.sql`

## Rotas principais

- `/director/novo-ensino-medio`
- `/director/permanencia`
- `/director/relatorios-nem`
- `/students`
- `/students/acompanhamento`
- `/students/historicos`
- `/director/documentos-nem`
- `/students/documentos`
- `/students/documentos/[issueId]`

## Cobertura atual

O sistema já passa a tratar currículo, trajetória, permanência, documentação anual e emissão formal de documentos com semântica própria do Novo Ensino Médio.

## O que ainda pode evoluir depois

- assinatura digital certificada e QR Code de verificação;
- integração com protocolo eletrônico da rede;
- integração com sistemas externos da rede;
- gestão mais profunda de parceria técnica com unidade executora externa.
