# 369 WELLNESS — conciliação da ATUALIZAÇÃO 0.46

Data: 08/10/2026. Fonte: documento enviado pelo usuário, ATUALIZAÇÃO 0.46.docx, e instrução explícita de que SPLIT PADRÃO é exclusivo do administrativo. Não importar regras do ERP LavaCar por semelhança. Este documento não ativa pagamentos nem publica o aplicativo.

## Regras recebidas e aplicação

| Tema | Regra do documento | Estado / ação |
| --- | --- | --- |
| Split padrão | Informação exclusiva do administrativo | Preparada migration PocketBase 0065: leitura de configurações financeiras e chaves desconhecidas somente admin; três chaves operacionais explicitamente liberadas a autenticados. Nenhuma implantação PocketBase executada. |
| Rede | Única global, sem remuneração por linhagem | Diretriz registrada; ordem de ocupação financeira ainda deve ser conciliada com a pontuação/posição. |
| Planos | Grátis, Básico, Pro e Premium; manter PRO em vez de PLUS | Grátis com multiplicador zero. Nomes existentes preservados. Cadastro e plano efetivo no servidor ainda pendentes. |
| Grátis | Não pontua e não aparece no ranking | Simulador corrigido: nem avaliação nem antiguidade geram pontos mensais; ordenação exclui e renumera os demais. Histórico fechado preservado, sem gerar novos pontos. |
| Fórmula | Plano × serviços × indicações + avaliação + antiguidade | Documento sustenta multiplicação direta; zero indicações, precisão da avaliação e escala de antiguidade ainda não especificados. Alternativas históricas não foram promovidas a regra ativa. |
| PRO PARCEIRO | Documento não redefine o teto | Mantida decisão explícita de 07/10: mínimo entre serviços elegíveis realizados e 150, antes dos multiplicadores. |
| Histórico | Meses fechados + mês vigente = total | Simulação aceita centésimos acumulados. Persistência mensal imutável/fechamento idempotente ainda pendentes. |
| Cashback | Disponível no fechamento, último dia do mês | Simulação não é saldo sacável. Fechamento financeiro, fuso/instante de corte e tratamento de estornos ainda pendentes. |
| Base | Tarifas dos serviços da rede no mês corrente | Documento especifica tarifas; não somar preço integral de consultas nem mensalidades por suposição. Configurações legadas alternativas precisam migração versionada. |
| Níveis | Progressão de 1, 2, 4, 8… até nível 36 | Estrutura matemática compatível com simulador; processamento atual limitado a 500 mil posições, não implementação de toda a capacidade teórica. |
| Equalização | Corretor por nível e soma conservada | Fórmula atual por nível é compatível com o exemplo de nove níveis; arredondamento em centavos deve conservar a soma. Individualização dentro do nível ainda diverge. |
| Upgrade do Grátis | Imediato e sem retroatividade | Exige eventos de serviços com plano e instante efetivos; não usar plano atual para recalcular serviços passados. Ainda pendente. |
| Troca entre pagos | Janela mensal definida pelo admin | Calendário configurável e validação no servidor pendentes. |
| Aluno vinculado | Escolhe plano/tarifa próprios ou tarifa paga pelo profissional e multiplicador deste | Escolha explícita por serviço/contrato e snapshot no servidor pendentes. Código legado que substitui sempre pelo plano vinculado não atende às duas opções. |
| Profissional | Usa seu próprio multiplicador vigente | Snapshot do plano por período/serviço necessário; não depender do plano atual mutável. |
| Carteira | Histórico, indicações, serviços, cashback, saques e depósitos | Preparação parcial; gateway, pagamento confirmado, ESG e auditoria financeira não concluídos. |

## Divergências concretas

1. A tabela exemplificativa posiciona 1.306 pontos abaixo de 1.007; a ordem precisa ser descendente por total, com desempate determinístico. Exemplos de posição não devem ser copiados literalmente.
2. Plano zero no cálculo anterior ainda ganhava avaliação e antiguidade. Corrigido na simulação atual; os caminhos PocketBase de recálculo/fechamento ainda exigem convergência e validação integrada antes de uso real.
3. No legado, platform_config tinha listagem e leitura abertas a qualquer autenticado. Revenue split e pool financeiro estavam na mesma coleção. Migration 0065 preparada com lista explícita das três chaves operacionais usadas nas telas: dpo_config, pix_config e min_services_to_validate_referral. Novas chaves são administrativas por padrão. A tela profissional agora solicita apenas o parâmetro de validação das indicações.
4. O simulador de cashback usa fatores diferentes entre pessoas do mesmo nível (por exemplo, duas posições com fatores diferentes). O documento mostra um valor aproximado por pessoa, mas não confirma esses fatores. Preservados até definição; nenhuma alteração silenciosa no dinheiro.
5. Rede global por ordem de entrada aparece na pergunta respondida, enquanto o total de pontos é definido como base do cashback. Falta definir se a posição financeira é reordenada pelo ranking no fechamento. Não misturar posição de árvore e posição de ranking sem decisão.
6. O arquivo não determina as regras gerais de ESG, indicações validadas, estornos e níveis sem elegíveis. Não usar as regras do ERP LavaCar sem adoção explícita.
7. A referência jurídica copiada no final do documento não foi validada nem adotada como requisito legal.

## Segurança e limites desta entrega

- Migration e schema exportado restringem listagem e leitura individual; escrita administrativa existente preservada.
- Rollback da migration mantém leitura somente administrativa, em vez de restaurar a exposição anterior. Isso também restringe as chaves operacionais em um rollback; efeito intencional documentado.
- Quatro testes de contrato executam os callbacks da migration em VM e verificam a lógica das expressões para admin, aluno, profissional, anônimo, chaves novas e rollback. Não substituem PocketBase real, HTTP, realtime, regras da coleção de usuários nem testes de escalada de papel.
- O endpoint legado de resumo financeiro já faz autenticação e verifica papel admin. Não houve auditoria completa de todos os endpoints.
- Não basta esconder componentes: dados financeiros devem permanecer restritos no backend. Constantes e fórmulas já presentes em código entregue ao navegador não têm garantia de segredo. Antes da produção, remover valores administrativos do bundle público e servir dados atuais somente por endpoints autorizados.
- Nenhuma tabela de split foi criada no Supabase, nenhuma migration Supabase foi alterada, nenhum crédito emitido e nenhuma prévia publicada nesta etapa.

## Próximos marcos priorizados

1. P0: homologar restrição do split no backend efetivamente usado, com sessões admin/aluno/profissional e acesso direto à API; validar que nenhum bundle/endpoint público expõe detalhes administrativos.
2. P0: definir zero indicações, distribuição dentro de cada nível e ordenação financeira global. Registrar versão de regras sem alterar fechamentos antigos.
3. P1: eventos elegíveis imutáveis com plano/tarifa/pagador no instante do serviço; upgrade sem retroatividade; contagem de indicação validada no servidor.
4. P1: snapshots mensais e fechamento idempotente com conciliação de centavos, estornos e trilha de auditoria; liberar cashback apenas após fechamento confirmado.
5. P1: gateway, reservas de agenda, pagamento do sinal confirmado por webhook e resgate com saldo disponível real.
6. P2: continuar os demais módulos dos pacotes 0–15. Todos permanecem parciais; zero pacotes concluídos integralmente.

Prévia demonstrativa existente, sem esta atualização: https://wellness-369-demo.ademariom07.chatgpt.site

Referências técnicas consultadas para as regras de acesso/migration: https://pocketbase.io/docs/api-rules-and-filters/ e https://pocketbase.io/docs/js-migrations/ .
