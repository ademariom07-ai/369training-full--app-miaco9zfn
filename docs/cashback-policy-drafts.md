# Rascunhos de distribuição — 19/10/2026

Aplicado em 369 WELLNESS (elahjmtboqhqqxmoaths), migration 20261019180413.
Arquivo criado pelo CLI e alinhado ao identificador da migration aplicada pelo MCP.

Tabela: public.cashback_policy_drafts.
RPC: public.create_cashback_policy_draft(p_request_id uuid, p_title text, p_top_pool_percent integer, p_top_participants_percent integer, p_top_ratio integer).

Percentuais inteiros de 1 a 99; multiplicador inteiro de 1 a 100. Padrão do simulador continua 80/20 e 10x.
Título, autor, data, versão do algoritmo e status draft ficam registrados. Apenas administrador autenticado não anônimo pode ler/criar. Autorização deriva do perfil no banco, nunca de user_metadata.
Histórico imutável para papéis da aplicação. Reenvio idêntico por autor/request_id retorna o original; conteúdo diferente com mesma chave falha. Não há UPDATE/DELETE direto nem ativação.
Os parâmetros podem ser armazenados para avaliação, mas uma distribuição só é válida após simular o montante e a população efetivos e verificar conservação e ordem dos pagamentos.

17 verificações SQL passaram com rollback das fixtures. Security advisors: nenhum alerta. Consulta posterior: zero rascunhos.
Não houve chamadas financeiras nem alteração de carteira, ranking, ESG ou fechamento.
Concorrência entre sessões e fluxo autenticado no navegador ainda não foram testados.

Pendente: formulário administrativo autenticado, leitura paginada do histórico e seleção de rascunho para simulação. Ativação financeira exige etapa separada de autorização, vigência, snapshot imutável do ciclo e validação do fechamento.
A prévia atual ainda simula localmente; não salva nesta tabela:
https://wellness-369-demo.ademariom07.chatgpt.site/evolucao.html#cashback
