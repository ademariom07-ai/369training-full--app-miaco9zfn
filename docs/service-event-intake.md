# Registro administrativo de eventos de serviço — 17/10/2026

## Entrega
Migration aplicada no projeto 369 WELLNESS (elahjmtboqhqqxmoaths), versão remota 20261017230613.
Arquivo inicialmente criado pelo CLI 2.81.3 e depois renomeado para corresponder ao histórico remoto do MCP.

Tabela public.service_event_intake e RPC public.record_service_event_intake:
- histórico append-only para os papéis da aplicação; sem INSERT/UPDATE/DELETE direto;
- autenticação não anônima e papel admin consultado no banco;
- idempotência global por event_id; reuso com conteúdo diferente rejeitado;
- unicidade por serviço/revisão; entrega fora de ordem não altera revisões existentes;
- aluno, profissional e competência imutáveis por serviço;
- created_by e created_at definidos pelo servidor;
- serialização por serviço via advisory lock transacional, inclusive entre administradores;
- leitura restrita ao administrativo nesta etapa; nenhuma exposição ao aluno/parceiro;
- verification SEMPRE unverified, inclusive se reported_payment for confirmed.

O registro é uma declaração administrativa. Não confirma pagamento, conclusão real ou autoria das avaliações.
Não aplicar esses dados diretamente ao projectServiceEvents como evidência financeira: o adaptador de eventos verificados ainda não existe.
Não altera carteiras, mensalidades, tarifas, pontos, ranking, ESG ou fechamento.
O service_id ainda não tem vínculo a uma tabela de agendamentos; falta a reconciliação com a origem.
Mudança de participantes/competência exige fluxo explícito de reconciliação, ainda pendente.
Não há gatilho para reabrir ou modificar um mês fechado.

## Verificação executada
17 testes SQL passaram no banco, em transação revertida:
atribuição/unverified, replay, conflito de event_id, revisão duplicada, entrega atrasada, competência e identidade, formato de mês, INSERT/UPDATE/DELETE direto, aluno com user_metadata falsificado, usuário anônimo, papel anon, administrador destituído, ausência de carteira criada.
Supabase security advisors: lints vazios após a migração.
Consulta final: 0 eventos e 0 usuários de autenticação; fixtures não permaneceram.
Concorrência entre sessões e fluxo autenticado via navegador NÃO foram testados.
Fonte: supabase/tests/service_event_intake.sql.

## Próxima integração
1. Conectar painel administrativo autenticado com paginação/filtro por competência e rótulo “não verificado”.
2. Criar adaptador confiável de agendamentos e avaliações; preservar identificadores de origem.
3. Quando existir provedor de pagamento, verificar assinatura, valor, beneficiário e conciliação; só então gerar fatos financeiros separados.
4. Implementar fechamento mensal idempotente, ajustes/estornos auditáveis e autorização específica.
Nenhum pacote 0–15 foi certificado como integralmente concluído por esta entrega.

## Prévia
https://wellness-369-demo.ademariom07.chatgpt.site/evolucao.html#eventos
A prévia existente continua sendo uma simulação local; NÃO grava nesta tabela.
Esta entrega é de backend e não modifica as telas publicadas.
