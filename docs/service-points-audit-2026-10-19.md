# Auditoria do fluxo de serviços e pontuação — 19/10/2026

## Evidências
Main consultada: e9fdf330f7a697549162a377ff6192a9c88b40d8.
Arquivo: pocketbase/hooks/on_review_created.js.
A leitura do repositório não comprova qual versão está implantada no PocketBase.

Divergências concretas neste hook:
- PRO PARCEIRO com coeficiente 1 e Math.min(serviços, parâmetro 150), em vez da decisão mais recente: coeficiente 2 e 150 fixos exclusivamente para pontuação do profissional.
- Antiguidade limitada a 10; decisão aprovada sem teto.
- Média arredondada; decisão aprovada média exata entre zero e cinco.
- Valor zero substituído por cinco através de || 5.
- Participante com coeficiente zero descartado pelo continue; deve receber avaliação + antiguidade e permanecer sem cashback.
- Validação mútua determinada por quantidade de avaliações >=2 neste hook. Ele não comprova autores distintos e correspondentes aos participantes; é necessário conferir as restrições de escrita antes de concluir explorabilidade.
- Seleção de serviços neste hook não verifica comprovante de pagamento e usa mês de criação, não um fechamento explicitamente conciliado.
- Consultas limitadas a 1000 usuários e 500 serviços/avaliações/indicações sem paginação neste caminho; podem truncar os cálculos.
- A tarifa Grátis aparece como R$1 no resumo calculado pelo hook. Isso não prova um débito real; exige convergência com tarifa zero.

## Avanço implementado na branch prep/supabase-vite
src/lib/serviceRankingProjection.ts integra projectServiceEvents com confirmedRanking e orderRankingPreview.
A contagem deixa de depender de um completedEligibleServices digitado separadamente:
1. valida identidades e papéis dos participantes;
2. deduplica eventos e seleciona a última revisão por serviço;
3. conta uma vez para aluno e profissional somente quando conclusão, pagamento informado e ambas avaliações estão presentes;
4. aplica plano, opção explícita de vínculo e regras comerciais vigentes;
5. recalcula a parcela mensal e soma previousPoints uma única vez;
6. mantém 150 de pontuação do PRO PARCEIRO separados do volume real e dos serviços do aluno.

IMPORTANTE: esta integração é apenas simulação. payment=confirmed é uma declaração de entrada, não um comprovante. Não conectar service_event_intake.reported_payment como se fosse verificação financeira.
previousPoints deve conter somente meses anteriores fechados. O chamador ainda precisa de origem confiável para isso.
Avaliação média, antiguidade, indicações e plano efetivamente ativo ainda dependem de snapshots confiáveis.
Estorno remove contribuição somente na projeção; não reabre nem altera fechamento persistido.
Nenhuma chamada escreve pontos, cobra tarifas ou credita carteira.

## Testes executados
44 testes passaram em cinco arquivos:
- serviceRankingProjection.test.ts
- serviceEventsPreview.test.ts
- wellnessCommercialRules.test.ts
- wellnessMonthlyProjection.test.ts
- serviceSettlementPreview.test.ts
TypeScript: tsc --noEmit concluído sem erros.
Cobertura desta rodada: duplicação, reexecução, revisão atrasada, estorno, avaliação ausente, pagamento pendente, mês distinto, plano grátis, PRO PARCEIRO e aluno vinculado.
Não foram executados teste de concorrência entre conexões, webhook real, login real ou homologação PocketBase.

## Próximos bloqueios
P0: convergir hooks de recálculo e fechamento PocketBase para a mesma regra, com fixtures e rollback; não mesclar na main automaticamente.
P0: adapter de eventos verificados, pagamento integral conciliado e avaliações de autores autorizados.
P0: fechamento transacional idempotente e ajustes auditáveis; distinguir pontos mensais de acumulados.
P1: conectar projeção ao painel, exibindo origem e versão da regra.
A prévia publicada não foi modificada nesta rodada.
