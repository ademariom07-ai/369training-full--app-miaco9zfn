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
