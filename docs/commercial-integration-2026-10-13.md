# Regras comerciais confirmadas — 13/10/2026

Módulo novo: src/lib/wellnessCommercialRules.ts. Fronteira pura de integração,
sem cobrança, saque, escrita de banco ou webhook ativo. Não substitui ainda
os caminhos legados de ranking e tarifas. Os chamadores devem migrar para esta
regra antes da homologação; não usar o antigo teto de 150 como regra atual.

- Aluno: mensalidades Grátis 0, Básico 10, Pro 20, Premium 30 reais.
- Vínculo: tarifa zero e plano efetivo do profissional; com PRO PARCEIRO,
  preservar plano anterior do aluno. Plano anterior ausente bloqueia cálculo.
- Parceiro: 0/1/2/3 reais por serviço concluído e avaliado pelo cliente.
- PRO PARCEIRO: 149 reais mensais; peso 2 e 150 fixos somente na pontuação.
  Contagens reais não são modificadas e não geram 150 cobranças.
- Elegibilidade: plano efetivo pago e média não arredondada estritamente >4,8.
- Pool: 38% de tarifas recebidas; pendentes não entram. Estornos e snapshots
  incompletos exigem conciliação. Duplicidades por ID financeiro e identidade
  de negócio são rejeitadas no lote.

Verificação: 13 testes passaram (novo módulo + feeCashbackPool), tsc --noEmit
sem erros. Sem testes reais de gateway ou banco. A política de indicações
continua explícita no argumento, sem escolher silenciosamente fator zero.

Próximas dependências: adaptar eventos autenticados do gateway e snapshots
históricos de plano/vínculo; garantir unicidade transacional persistente entre
lotes; autorizar acesso administrativo no servidor; conectar UI à fonte;
homologar estornos, reconexão e fechamento mensal. Flags recebidas pelo módulo
não comprovam autenticidade. Não há alegação de atualização em tempo real.

## Integração de cálculo — 14/10/2026

`projectWellnessMonth` reúne tarifas confirmadas, resolução do plano por vínculo,
pontuação, ordenação, elegibilidade, Pareto e ESG. Retorna pontos e valores por
identidade, serviços reais preservados, totais conciliáveis e indicação explícita
de simulação sem autorização de pagamento. Rejeita snapshots de participantes
fora do mês, duplicidades, plano anterior ausente e combinações Pareto que
invertem pagamentos. A UI e os handlers legados ainda não chamam esse fluxo.

Validação local: 19 testes passaram (projeção mensal + regras comerciais + pool),
verificação TypeScript sem erros. Não há evidência de homologação no banco real.
Próximo marco: adapter autenticado com snapshots históricos e unicidade no banco,
seguido de conexão do painel somente leitura. Sem migrations ou deploy executados.

## Atualização de pontuação — escolha do aluno vinculado (15/10/2026)

A decisão posterior de manter ou migrar o coeficiente substitui a antiga herança automática e a exceção obrigatória de plano anterior no PRO PARCEIRO. `resolveStudentPlan` agora exige escolha explícita para aluno vinculado; plano próprio permanece como fotografia histórica preservada. Herança de benefícios e isenção mensal permanecem independentes da escolha do coeficiente. Sem escolha registrada, projeção falha para conferência em vez de presumir migração.

Para aluno que migra ao PRO PARCEIRO, o plano efetivo exclusivamente para pontuação/eligibilidade é normalizado para peso 2 (`pro`); não concede mensalidade PRO PARCEIRO nem seus 150 serviços fixos. Exemplo: 10 serviços reais × 2 × 1 indicação + nota 5 + 1 mês = 26 pontos. Profissional PRO PARCEIRO: 150 × 2 × 1 + 5 + 1 = 306. Plano próprio grátis mantido: nota + antiguidade sem teto e sem cashback, mesmo recebendo os benefícios de IA do vínculo.

Projeção mensal v2 usa a escolha; política de IA reutiliza o mesmo resolvedor para não divergir. `previousStudentPlan` continua apenas como campo legado do contrato, sem decidir migração; `plan` precisa ser o plano próprio preservado na origem. O coeficiente nunca altera a quantidade real de serviços. Avaliação permanece média exata de 0 a 5, cashback exige nota estritamente maior que 4,8, pontos anteriores acumulam e Grátis continua no ranking. A política de indicações permanece parâmetro explícito, sem mudança silenciosa.

Validação: 63 testes passaram (ranking, regras comerciais, projeção mensal, política IA e mensalidades) e TypeScript do aplicativo passou. Quatro casos novos verificam escolha ausente, manutenção do Grátis, herança sem 150 e preservação dos dados. Limite: cálculo de projeção, sem recálculo de registros reais. Persistência da escolha, fotografia mensal confiável e convergência dos hooks legados ainda pendentes. Pareto, ESG e tarifas não foram alterados.
