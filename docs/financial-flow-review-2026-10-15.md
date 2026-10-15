# Revisão do fluxo financeiro — 15/10/2026

Escopo: branch prep/supabase-vite em b86043f504c6817b4b71383c171a3963ddbd84ce,
PR #1 aberto em 22201457977e1d603a317b1cc773e67064d9fa81. Não foi acessado banco
real nem gateway. Nenhuma migration ou publicação executada.

## Evidências e divergências
- on_service_completed.js: caminhos create/update cobram Grátis R$1, disparam
  ao concluir sem exigir pagamento confirmado e avaliação mútua; busca antes
  da gravação não prova exclusão de duplicidades concorrentes.
- on_review_created.js na branch: primeira avaliação marca validated=true.
  PR #1 exige avaliadores aluno e profissional, mas permanece aberto.
- plans_change.js na branch: ativa plano antes de gravar mensalidade pendente;
  PR #1 contém débito/ativação em transação. Não mesclar sem conciliar regras.
- payments_webhook.js: endpoint genérico registra payload/assinatura e acusa
  recebimento; não verifica autenticidade nem liquida pagamentos.
- security_guards.js no PR: aluno aprovado automaticamente, divergente da
  nova exigência de aprovação manual/API também para alunos.
- Cálculo novo de projeção e regras comerciais existe, mas não substitui ainda
  hooks/UI legados. Distinguir implementação pura de operação financeira real.

## Alterações desta revisão
Novo limite comercial exige avaliação do cliente E do profissional na tarifa
por serviço. Nova função previewServiceSettlement confere valor combinado,
pagamento confirmado, conclusão, ambas avaliações, disputa/estorno e separa
crédito líquido, tarifa e custo do gateway (pagador explícito). Grátis e PRO
PARCEIRO não têm tarifa por serviço. Chave estável por serviço, independente
do ID da notificação. Ainda não persiste unicidade entre execuções.
26 testes locais passaram e tsc --noEmit sem erros.

## Implementação recomendada
1. Conta com indicação válida e aprovação verificável. API de identidade não
   equivale à validação de credenciais profissionais. Aprovação auditável.
2. Pedido guarda preço aceito, plano e vínculo aplicáveis como snapshot.
3. Assinatura recebida ou débito de saldo disponível confirmado ativa plano;
   vínculo suspende cobranças futuras, preserva plano próprio anterior.
4. Gateway confirma dinheiro; separar saldo pendente de saldo disponível.
5. Conclusão + duas avaliações + pagamento confirmado geram liquidação uma vez:
   transação atômica, restrição única por serviço, lançamentos balanceados.
6. Eventos autenticados, processados mesmo fora de ordem, com fila e retentativas;
   banco é fonte dos valores, não os campos enviados pelo navegador.
7. Tarifas efetivas entram no administrativo; 38% sobre tarifas, não sobre o
   preço do serviço. Arredondar pool agregado em centavos. Não abater custos
   do gateway da base de 38% sem decisão expressa.
8. Ranking acumulado, projeção durante mês e fechamento mensal imutável;
   estorno por contralançamento, sem apagar histórico.

## Decisões pendentes
- Novo prompt usa peso 1 e peso 2 para PRO PARCEIRO. Última decisão explícita
  anterior foi peso 2; manter até confirmação, 150 somente para pontuação.
- Novo prompt generaliza herança do plano; confirmar se mantém exceção anterior
  do aluno vinculado a PRO PARCEIRO (plano anterior próprio).
- Confirmar manutenção do sinal no agendamento, com saldo após serviço.
- Definir quem suporta custo do gateway e qual provedor/conta de teste.
- Definir prazo e exceção quando uma parte não avalia, para evitar bloqueio
  indefinido do recebimento. Sem aprovação automática silenciosa.

## Fontes oficiais consultadas em 15/10/2026
https://docs.stripe.com/webhooks
https://docs.stripe.com/connect/charges
https://docs.stripe.com/connect/marketplace/tasks/accept-payment
https://www.mercadopago.com.br/developers/pt/docs/split-payments/additional-content/your-integrations/notifications/webhooks
https://www.mercadopago.com.br/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace

Documentação sustenta validação de assinatura, retentativas, consulta do
pagamento, separação cobrança/repasse e restrições de reembolso. Escolha do
provedor depende do fluxo e recursos habilitados; não está definida nesta revisão.

## Correção de ativação e contenção do débito antecipado

A rota plans/change agora reconsulta usuário aprovado em transação. Mensalidades
criam/reutilizam solicitação pendente, retornam 202 e preservam plano/status/
expiração atuais. Flags de pagamento do cliente não ativam plano. Plano e valor
diferentes de uma pendência exigem conciliação. Falha de gravação não ativa plano.
Alunos não podem selecionar PRO PARCEIRO. Somente mensal está habilitado: anuidades
anteriores precisam de aprovação comercial específica. Planos de profissional
Básico/Pro/Premium não criam mensalidade nem vencimento mensal artificial.
As duas telas de alteração exibem pendência, sem anunciar ativação.

Removidos os dois débitos de tarifa disparados apenas pela conclusão do serviço.
IMPORTANTE: essa contenção suspende a cobrança automática antiga por serviço;
ainda não instala a cobrança posterior. O adapter autenticado de liquidação
após pagamento e avaliação mútua permanece pendente. Também não há checkout ou
handler de ativação pós-pagamento homologado. O financeiro NÃO está operacional.
Outros caminhos legados (backfill, rotinas de carteira, permissões e PR #1) precisam
convergir antes de qualquer publicação. Nenhuma alteração de saldos históricos.

Validação: 46 testes locais passaram em seis arquivos e tsc --noEmit sem erros.
Testes de hook usam VM e mocks, não comprovam isolamento concorrente no PocketBase
real. Sem publicação, migrations ou testes reais de pagamento nesta etapa.

## Preparação sem API de pagamentos

Implementada consulta administrativa somente leitura de mensalidades pendentes,
filtrada por mês de registro UTC−03. Mostra quantidade, valor solicitado e
referências repetidas; não expõe identidades nem autoriza ativação/pagamento.
Pendências contribuem com zero para cashback. Nova seção junto à conferência
de tarifas registradas. Troca de sessão limpa os dados e descarta respostas antigas.
Backend paginado em transação, parâmetros SQL vinculados, erros sem totais parciais.
19 testes locais passaram (pendências, bloqueio de ativação, fonte de tarifas),
TypeScript sem erros. Não homologado em navegador/banco real, não publicado.
API de pagamentos será inserida posteriormente pelo usuário; sua ausência não
impede a consulta de registros, mas continua impedindo liquidação automática.
