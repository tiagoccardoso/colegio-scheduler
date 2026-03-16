# Checklist completo de homologação — NEM

## 1) Aplicação técnica
- [ ] Fazer backup do banco antes da implantação.
- [ ] Aplicar os patches anteriores do NEM já existentes no projeto.
- [ ] Aplicar `db/patch_novo_ensino_medio_fase8_conformidade_total.sql`.
- [ ] Confirmar que as tabelas novas foram criadas:
  - [ ] `school_itinerary_offers`
  - [ ] `student_itinerary_selections`
  - [ ] `student_history_subject_items`
- [ ] Confirmar os novos campos em:
  - [ ] `school_curriculum_settings`
  - [ ] `subjects`
  - [ ] `classes`
  - [ ] `student_enrollments`
- [ ] Validar RLS/policies das novas tabelas com um usuário autenticado da escola.
- [ ] Validar grants CRUD das novas tabelas.
- [ ] Rodar lint e typecheck no ambiente do projeto.
- [ ] Testar restore/rollback antes de subir para produção.

## 2) Parametrização institucional da escola
- [ ] Informar UF da escola.
- [ ] Informar nome do currículo/referencial estadual vigente.
- [ ] Informar versão curricular da escola.
- [ ] Registrar URL/ato normativo estadual quando existir.
- [ ] Revisar mínimos configurados de carga horária.
- [ ] Revisar mínimo de itinerários por escola.
- [ ] Definir se a escola vai monitorar espanhol no sistema.
- [ ] Definir se a escola vai exigir itinerários presenciais no sistema.
- [ ] Definir modo de Projeto de Vida:
  - [ ] `TRANSVERSAL`
  - [ ] `COMPONENTE`
- [ ] Confirmar se Português e Matemática devem ser verificados em todos os anos para a rede.

## 3) Formação Geral Básica (FGB)
- [ ] Confirmar meta mínima de 3.000h totais do Ensino Médio.
- [ ] Confirmar mínimo de 2.400h de FGB no regular.
- [ ] Confirmar mínimo de 600h de itinerários no regular.
- [ ] Classificar corretamente cada componente curricular da FGB.
- [ ] Revisar códigos obrigatórios da FGB cadastrados no sistema.
- [ ] Validar presença dos componentes obrigatórios ao longo da trajetória.
- [ ] Validar presença anual de Língua Portuguesa.
- [ ] Validar presença anual de Matemática.
- [ ] Conferir se Inglês, Arte, Educação Física, Biologia, Física, Química, Filosofia, Geografia, História e Sociologia estão devidamente mapeados na FGB quando aplicável ao currículo da rede.

## 4) Itinerários Formativos de Aprofundamento
- [ ] Cadastrar ofertas formais de itinerário em `school_itinerary_offers`.
- [ ] Garantir pelo menos dois itinerários por escola.
- [ ] Informar eixo/área de cada itinerário.
- [ ] Informar coorte vinculada ao itinerário quando aplicável.
- [ ] Informar versão curricular do itinerário.
- [ ] Informar carga horária total do itinerário.
- [ ] Informar se o itinerário é presencial.
- [ ] Vincular turmas a uma oferta formal de itinerário.
- [ ] Confirmar coerência entre nome da turma e oferta vinculada.
- [ ] Revisar se os componentes classificados como `ITINERARIO` pertencem ao eixo correto.

## 5) Escolha do estudante
- [ ] Registrar a escolha do estudante em `student_itinerary_selections`.
- [ ] Registrar data da escolha.
- [ ] Registrar status da escolha.
- [ ] Registrar alterações posteriores quando houver troca de percurso.
- [ ] Vincular matrícula (`student_enrollments`) à oferta formal escolhida.
- [ ] Conferir se o itinerário escolhido bate com a turma do aluno.
- [ ] Garantir trilha de orientação pedagógica fora ou dentro do processo interno da escola.

## 6) Formação técnica e profissional
- [ ] Revisar turmas marcadas como técnico articulado.
- [ ] Confirmar existência de componentes/tabelas de formação técnica para essas turmas.
- [ ] Revisar carga horária técnica prevista por modelo.
- [ ] Validar integração curricular no PPP quando houver curso técnico.

## 7) Projeto de Vida
- [ ] Se `TRANSVERSAL`, confirmar que o PPP e os planejamentos registram essa transversalidade.
- [ ] Se `COMPONENTE`, confirmar componente cadastrado e vinculado à trajetória.
- [ ] Revisar instrumentos de acompanhamento do estudante coerentes com Projeto de Vida.

## 8) Espanhol
- [ ] Decidir institucionalmente se haverá monitoramento de oferta de espanhol.
- [ ] Marcar componentes de espanhol com `language_code = ES`.
- [ ] Marcar `is_spanish_optative = true` quando adequado.
- [ ] Validar como a rede/UF exige a oferta de espanhol.

## 9) Presencialidade
- [ ] Confirmar se a rede exige presencialidade para os itinerários ofertados.
- [ ] Marcar `classes.is_presential` corretamente.
- [ ] Marcar `school_itinerary_offers.is_presential` corretamente.
- [ ] Revisar casos híbridos/excepcionais com respaldo normativo da rede.

## 10) Cadastro de turmas
- [ ] Preencher série da turma.
- [ ] Preencher ano letivo.
- [ ] Preencher coorte de ingresso.
- [ ] Preencher versão curricular.
- [ ] Preencher modelo de oferta do NEM.
- [ ] Preencher eixo do itinerário quando aplicável.
- [ ] Vincular `itinerary_offer_id` quando aplicável.
- [ ] Revisar capacidade máxima e vagas.
- [ ] Revisar status ativo/inativo.

## 11) Cadastro de componentes
- [ ] Classificar cada componente como FGB, itinerário, formação técnica, eletiva etc.
- [ ] Definir área de conhecimento correta.
- [ ] Definir código obrigatório da FGB quando couber.
- [ ] Revisar carga horária anual.
- [ ] Revisar aulas semanais sugeridas.
- [ ] Revisar eixo do itinerário do componente.
- [ ] Revisar ementa.
- [ ] Revisar habilitação docente requerida.
- [ ] Revisar componente marcado como educação digital.
- [ ] Revisar componente marcado como Projeto de Vida.

## 12) Validação por coorte
- [ ] Rodar validação da coorte 1A/2A/3A.
- [ ] Confirmar cobertura das três séries.
- [ ] Confirmar horas acumuladas da trajetória.
- [ ] Confirmar FGB acumulada.
- [ ] Confirmar itinerário acumulado.
- [ ] Confirmar técnica acumulada quando aplicável.
- [ ] Confirmar presença anual de Português e Matemática.
- [ ] Confirmar presença dos componentes obrigatórios da FGB.
- [ ] Confirmar educação digital na trajetória.
- [ ] Confirmar Projeto de Vida conforme o modo configurado.
- [ ] Confirmar oferta de espanhol quando monitorado.

## 13) Histórico e documentos
- [ ] Criar/atualizar histórico do aluno.
- [ ] Lançar itens detalhados por componente em `student_history_subject_items`.
- [ ] Conferir série e ano letivo em cada item.
- [ ] Conferir carga horária por componente.
- [ ] Conferir média final por componente.
- [ ] Conferir frequência por componente.
- [ ] Conferir resultado final por componente.
- [ ] Conferir consistência entre histórico, matrícula e itinerário escolhido.
- [ ] Revisar layout final do histórico conforme exigência da rede/UF.
- [ ] Revisar necessidade de assinatura digital, carimbo, numeração ou integração externa.

## 14) Testes operacionais mínimos
- [ ] Criar uma escola de teste com configuração regular.
- [ ] Criar dois itinerários formais.
- [ ] Criar turmas 1A, 2A e 3A para uma mesma coorte.
- [ ] Vincular componentes FGB e itinerários.
- [ ] Matricular estudante e registrar escolha do itinerário.
- [ ] Gerar histórico com itens por componente.
- [ ] Verificar alertas de não conformidade ao remover Português de um ano.
- [ ] Verificar alertas de não conformidade ao reduzir itinerários para apenas um.
- [ ] Verificar alertas de não conformidade ao retirar espanhol quando monitorado.
- [ ] Verificar alertas de não conformidade ao marcar oferta não presencial quando bloqueada.

## 15) Homologação jurídica/pedagógica final
- [ ] Conferir matriz contra o currículo oficial da UF.
- [ ] Conferir PPP da escola.
- [ ] Conferir regras de secretaria escolar da rede.
- [ ] Conferir exigências específicas de documentação oficial.
- [ ] Registrar ata interna de homologação.
- [ ] Aprovar liberação para produção.
