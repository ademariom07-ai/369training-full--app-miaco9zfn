# Projeção de eventos de serviços — preparação sem APIs

Entrega de 17/10/2026. `projectServiceEvents` é um replay puro de snapshots completos versionados. Não persiste eventos, não autentica o emissor e não autoriza lançamentos financeiros ou pontos. Entrada `confirmed` não comprova pagamento.

Seleciona a maior revisão por serviço; repetição idêntica de eventId é ignorada. IDs reutilizados com dados diferentes, versões conflitantes e mudança de participantes/competência interrompem a projeção. Competência é explícita e não é inferida de datas do navegador. Para o mês consultado, serviço concluído, pagamento confirmado e ambas as avaliações são necessários para uma contagem por aluno e parceiro. Cancelamentos e disputas/estornos não são elegíveis; estes últimos exigem conciliação.

Não recalcula média de avaliações, planos, indicações, pontuação anterior nem crédito. Não altera snapshots mensais já fechados. Integração real requer armazenamento transacional, restrições únicas, autenticação/autorização do emissor e vínculo com comprovantes confiáveis. Eventuais correções de competência/participantes precisam de fluxo específico auditado, não de substituição silenciosa.

10 testes locais cobrem repetição, requisitos pendentes, ordem de entrega, estorno, conflitos, competência e cancelamento. A central privada tem laboratório com um serviço e duas identidades fictícias para explorar esses resultados; não chama APIs e não salva dados entre recargas.
