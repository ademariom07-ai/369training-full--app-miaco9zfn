# Integração das correções de cashback 0.46

09/10/2026 — branch prep/supabase-vite. Simulação; não realiza fechamento, créditos ou saques.

## Comparação com o arquivo recebido

Revisado o conteúdo de 369-WELLNESS-correcao-cashback-0.46.zip. A branch já conserva centavos com BigInt, aplica exclusões, mantém orçamento de níveis sem elegíveis não distribuído e suporta a população de referência de 369.371 participantes sem truncar a tabela no motor.

A orientação do arquivo para retirar Grátis do ranking foi superada pela confirmação do usuário: Grátis recebe avaliação e antiguidade, conserva sua posição por pontos e não recebe cashback. Não foi incorporada a implementação financeira com ponto flutuante nem a segunda função ESG: permanece o módulo mensal compartilhado, com redução agregada arredondada uma vez e saldo liberado calculado por diferença. Mantido o limite de 500.000 posições e a lista completa; não adotada a amostra de 5.000 nem o aumento de limite sem necessidade.

## Correções integradas

- Modo real explícito no motor: uma lista vazia nunca passa a representar pessoas elegíveis fictícias. A compatibilidade do modo sintético continua para chamadas anteriores sem dados reais; a tela informa explicitamente o modo escolhido.
- Zero posições é válido: nenhuma pessoa ou nível fictício, valor integral do pool não distribuído.
- A tela usa zero posições se não recebeu participantes reais; erros exibem resultado vazio e bloqueiam exportação.
- A marcação isExcluded do registro de ranking é transmitida ao motor. A assinatura já era transmitida na branch.
- O carregamento de posições reais evita espalhar centenas de milhares de argumentos em Math.max; a mensagem distingue quantidade de pessoas de posição máxima.
- Texto corrigido: valor não distribuído não é apresentado como reserva de carteira.

## Verificação e limites

43 testes de cálculo, ranking, CSV e ESG aprovados, incluindo quatro regressões novas: população vazia, modo real sem dados, modos incompatíveis e permanência de Grátis no ranking sem cashback. TypeScript, lint dos arquivos alterados, build e git diff --check aprovados. Estes testes não homologam navegador, autorização de backend, pagamento ou fechamento financeiro.

Não alterados banco, políticas RLS, carteiras ou publicação. Quinze migrations permanecem aplicadas conforme etapa anterior. Pacotes 0–15 continuam parciais; nenhum integralmente concluído.

Próximos marcos: convergir o modelo financeiro aprovado com fechamento transacional; registrar regras históricas de plano/pagador; validar os fluxos reais com autenticação e concorrência. O vínculo isolado não comprova a escolha de pagador e não deve alimentar créditos oficiais.
