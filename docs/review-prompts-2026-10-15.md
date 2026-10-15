# Revisão dos prompts — 369 WELLNESS — 15/10/2026

MVP parcial; não homologado para operação financeira real. Base inspecionada:
branch prep/supabase-vite, remoto 1d10d28c7674ebc266b6c836c9a2500a022b9c79.
Fontes: prompts desta conversa, código e documentos locais, consulta atual da
branch no GitHub. Sem acesso ao banco de produção, sessão de usuário real,
validação visual em navegador ou gateway. Pacotes 0–15: nenhum pode ser declarado
totalmente aplicado/validado com as evidências disponíveis.

## Sete critérios
| Critério | Estado | Evidência/avanço | Lacuna | Próxima verificação |
|---|---|---|---|---|
| MVP navegável | Parcial | Prévia integral com símbolo original, três perfis e simulador | HTML usa dados demonstrativos; código React ainda tem estilos antigos | Unificar versão visual e aplicação; testar fluxos desktop/mobile e persistência |
| Agenda | Parcial | AgendaServicos.tsx contém grade 05–00 e Liberar Dia | Reserva paga, concorrência, cancelamento/no-show não homologados | Duas tentativas no mesmo horário; liberação só após sinal confirmado |
| Ranking | Parcial | wellnessMonthlyProjection integra regras comerciais/Pareto/ESG, testes locais | Hooks antigos ainda têm teto 150/peso 1 e tratamento de vínculo divergentes; fechamento não ativo | Uma fonte de cálculo, snapshots mensais, desempates e retomada idempotente |
| Backoffice | Parcial | Gestão de alunos, perfil, conteúdos, treino, dieta, carteira e link_professional.js | Vínculo sem snapshot completo do plano anterior; isolamento não homologado | Testar dois profissionais com contas distintas e vínculo/desvínculo histórico |
| Administrativo | Parcial | Consulta de tarifas, mensalidades pendentes, aprovações e auditoria | Mensalidades não compõem a antiga consulta type=tarifa; ausência de painel financeiro conciliado | Separar solicitado/recebido/disponível, incluir mensalidades liquidadas via adapter |
| IA integrada | Parcial | Copiloto, treino, dieta, hidratação e wearable possuem código | wearables_gateway usa is_mock_ready; IA cobra excedentes em caminhos legados; chamadas e aceite não homologados | Conferir limites, acesso de todos os alunos, aceite/privacidade, encaminhamento e wearable real |
| Técnicos | Parcial / operação bloqueada | Testes locais e módulos de autorização; branch sem publicação | Banco/auth real, migrations aplicadas, pagamento, segurança de segredos e LGPD sem validação atual completa | Ambiente de homologação com contas separadas, restauração e auditoria de acesso |

## Avanços comprovados desde o início da revisão financeira
- Mensalidades não ativam plano antecipadamente; parceiros Básico/Pro/Premium
  não geram mensalidade. Telas diferenciam solicitação pendente de ativação.
- Consulta administrativa somente leitura de mensalidades pendentes: não
  alimenta cashback ou saldo disponível; indica referências repetidas.
- Módulos novos integram tarifas, elegibilidade >4,8, ranking, Pareto e ESG.
  Isso não substitui automaticamente os hooks legados.
- Nesta etapa foi bloqueado admin_backfill_tarifas.js: cobria serviços apenas
  concluídos e cobrava Grátis R$1. Agora 503 para admin, 401/403 para outros,
  sem acessar banco ou criar tarifas. A contenção não implementa recuperação.
- 17 testes locais passaram nesta etapa (backfill, pendências e ativação),
  tsc --noEmit sem erros. Não equivalem a testes de produção ou navegador.

## Bloqueios e divergências
| Requisito | Evidência em conflito | Impacto | Encaminhamento |
|---|---|---|---|
| PRO PARCEIRO 150 somente pontuação | Confirmação peso 2 em 13/10; prompt financeiro usa 1 e 2; hooks antigos teto | Pontuação diferente por caminho | Preservar 2 no módulo novo; não ativar caminhos divergentes |
| Aluno vinculado | Exceção PRO PARCEIRO usa plano anterior, mas novo texto generaliza herança | Elegibilidade/pontos incorretos | Snapshot de plano e vínculo antes da alteração; decisão sobre exceção segue pendente |
| Avaliação mútua | on_review_created.js da branch valida na primeira; módulo comercial exige ambas | Serviço pontua cedo | Integrar validação de autor/alvo e duas avaliações, com unicidade no banco |
| Somente posição de ranking | on_user_create.js ainda cria tree_position/tree_level | Duas noções de posição | Desvincular árvore de qualquer distribuição; migrar telas após inventário |
| Cadastro aprovado/verificado | on_user_create.js marca verified automaticamente | Verificação sem evidência | Rever fluxo de verificação, indicação e aprovação sem autoaprovação silenciosa |
| IA para todos os alunos | aluno_agent_copilot.js contém quotas/débito de excedentes | Possível barreira e tarifa não conciliada | Confirmar acesso e política de excedentes; não presumir autorização de cobrança |
| Identidade clara original | Prévia restaurada; AgendaServicos e PlanChangeSection ainda têm tema escuro/dourado | Versões visualmente diferentes | Aplicar identidade original à aplicação integrada |

API de pagamentos foi adiada expressamente: não bloquear correções independentes.
Ela é necessária para prova de recebimento, ativação automática, repasse e estorno.
Os números de testes de etapas anteriores não foram somados como nova execução.
As regras do ERP Lava-car não foram incorporadas; redistribuição de ESG não foi
adotada silenciosamente. Dados/documentos clínicos não foram inspecionados.

## Próximos marcos, até cinco
| Prioridade | Resultado | Dependências | Papel sugerido | Aceite |
|---|---|---|---|---|
| P0 | Eliminar todos os caminhos financeiros divergentes | Inventário hooks/carteira/IA/PR #1 | Backend e segurança | Nenhuma tarifa antes das condições; nenhuma ativação sem pagamento; retries sem duplicar |
| P0 | Autorização e verificação reais | Ambiente de homologação e política de aprovação | Backend e segurança | Usuário não altera saldo/plano/aprovação; parceiros não acessam dados alheios |
| P1 | Ranking e vínculo com histórico único | Decisões PRO PARCEIRO e snapshots | Backend/produto | Mesmos dados produzem mesmo ranking em todos os caminhos; fechamento repetido não duplica |
| P1 | Agenda e financeiro demonstrados ponta a ponta | Cenários de teste; depois gateway | Full stack/QA | Reserva sem duplicidade; saldo pendente/disponível; cancelamento e extrato coerentes |
| P2 | Unificar visual e homologar IA/backoffice | Navegador, integrações e consentimentos | Frontend/IA/QA | Três perfis no visual original; encaminhamento, wearable e fluxos clínicos com limites explícitos |

Sem prazos ou responsáveis nomeados. Critérios são metas de aceite, não alegação
de implementação. Demais decisões financeiras já listadas na revisão anterior
(peso, exceção de vínculo, sinal, custo gateway e ausência de avaliação) não foram
repetidas como perguntas nesta etapa, pois não bloquearam a contenção realizada.
