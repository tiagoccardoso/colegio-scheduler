# Novo Ensino Médio — Fase 3

Esta fase consolida o que faltava para o sistema começar a sustentar documentação e gestão de trajetória:

- histórico escolar anual por estudante;
- registro de horas cumpridas em FGB, itinerário e formação técnica;
- trilhas técnicas/profissionais com progresso e status de certificação;
- painéis gerenciais por coorte e modelo de oferta.

## Ordem de aplicação

1. `db/patch_novo_ensino_medio.sql`
2. `db/patch_novo_ensino_medio_fase2.sql`
3. `db/patch_novo_ensino_medio_fase3.sql`

## Telas adicionadas

- `/students/historicos`
- `/director/relatorios-nem`

## Objetivo funcional

A fase 1 fez o sistema entender currículo.
A fase 2 fez o sistema acompanhar estudante.
A fase 3 começa a fechar o ciclo com documentação escolar e visão gerencial.

Ainda não substitui um histórico oficial com assinatura digital, layout estadual específico ou integração com sistemas externos da rede. Mas já organiza os dados para esse passo sem cair na síndrome da planilha ressuscitada.
