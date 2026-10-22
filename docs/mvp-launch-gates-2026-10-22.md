# 369 WELLNESS — critérios de lançamento

Data: 22/10/2026. Ambiente Supabase elahjmtboqhqqxmoaths. Revisão de prontidão; não autoriza abertura pública nem operação financeira.

## Verificação executada

11 verificações SQL aprovadas usando SET LOCAL ROLE authenticated/anon e claims controlados em transação revertida. Dois usuários fictícios e um rascunho financeiro temporário; nenhuma senha, envio de e-mail ou transação financeira.

- Aluno lê o próprio perfil.
- Aluno não lê o perfil de outro participante.
- user_metadata.role=admin não libera rascunhos de cashback.
- Autenticado não possui UPDATE na coluna role.
- Autenticado não possui UPDATE na coluna approved.
- Autenticado não possui UPDATE direto em wallet_accounts.
- Profissional não lê perfil do aluno diretamente.
- Profissional não lê rascunho financeiro administrativo.
- Admin autorizado lê o rascunho financeiro temporário.
- Sessão is_anonymous=true não lê perfil.
- Papel anon não possui SELECT direto em profiles.

Limites: testes de banco, não testes de navegador ou tokens emitidos pelo Auth. Bloqueio da leitura direta não comprova segurança de todas as RPCs. Treinos, vínculos, agenda, saques e geração de IA exigem verificações específicas. RLS habilitada não é prova suficiente de isolamento.

## Marcos de lançamento

| Prioridade | Resultado | Dependência | Aceite |
|---|---|---|---|
| P0 | Identidade e autorização completas | Contas aluno/profissional/admin e cliente publicado | Cadastro, confirmação, recuperação, login, logout; chamadas de outro usuário e ações administrativas negadas nas RPCs e API |
| P0 | Jornada aluno-profissional persistente | Profissional aprovado e vínculo consentido | Profissional entrega treino revisado; aluno correto recebe e registra execução; outro aluno não vê; atualizar página preserva dados |
| P0 para versão financeira | Pagamentos e tarifas reais | Provedor ainda a fornecer | Eventos assinados e idempotentes; mensalidade só ativa após pagamento; tarifa por serviço validado; estorno conciliado |
| P1 | Agenda confiável | Disponibilidade liberada e fluxo de pagamento | Duas reservas concorrentes não ocupam mesmo horário; cancelamento/no-show persistentes |
| P1 | Pontos/ranking/cashback | Serviços e tarifas verificados, fechamento mensal | Regra vigente, sem duplicação, total reconciliado em centavos, Pareto configurável e ESG aplicados com histórico |
| P1 | IA operacional | Chaves configuradas, quotas no servidor e consentimento | Geração autenticada, revisão quando exigida, entrega ao destinatário, erros recuperáveis e limites por plano |
| P0 antes de público externo | Hospedagem e privacidade | Política de acesso, textos de consentimento e operação | Participante autorizado externo consegue acessar; recuperação de backup testada; monitoramento; tratamento dos dados definido |

## Escopo proposto para piloto fechado

Cadastro, aprovação profissional, vínculo aluno-profissional e treino revisado com execução registrada. Liberar somente após concluir a jornada acima. Financeiro e cashback permanecem simulações identificadas até a integração validada. Isso é proposta de escopo, não declaração de que o piloto já está pronto.

## Pendências de evidência

- Navegação administrativa após promoção do proprietário ainda sem homologação completa.
- Proteção contra senhas vazadas foi reportada desativada pelo advisor em 21/10; correção ainda não confirmada.
- Legado PocketBase e implementação Supabase devem convergir antes de escolher o caminho operacional; não executar ambos como fontes financeiras.
- Nenhum pacote 0–15 certificado integralmente nesta revisão.

## Links

- Acesso real: https://wellness-369-demo.ademariom07.chatgpt.site/acesso.html
- Demonstração: https://wellness-369-demo.ademariom07.chatgpt.site/
- Evolução e simulações: https://wellness-369-demo.ademariom07.chatgpt.site/evolucao.html
