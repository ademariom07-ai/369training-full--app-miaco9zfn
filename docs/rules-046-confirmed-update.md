# 369 WELLNESS — decisões atualizadas em 12/10/2026

Fonte: respostas diretas do usuário após a análise da ATUALIZAÇÃO 0.46. Este registro prevalece sobre a interpretação anterior de que Grátis não pontua/não aparece e sobre qualquer posição financeira por ordem de entrada.

## Fonte do cashback — 13/10/2026

Confirmado pelo usuário: inicialmente 38% de todas as tarifas de alunos e parceiros. Base não é o preço integral do serviço nem saldo da carteira. O motor recebe centavos das tarifas, soma alunos + parceiros e arredonda uma única vez 38% do total; Pareto distribui esse montante sem reaplicar percentual. ESG permanece sobre o bruto individual mensal. Os outros 62% não recebem destino definido nesta implementação; split interno permanece administrativo.

Preparado contrato de entrada por cobrança (identificador único, pagador, tipo aluno/parceiro, competência, valor, estorno e status) para futura alimentação real. Somente registros conciliados entram na conferência; pendentes/anulados ficam fora. Duplicidades, conjunto incompleto, valores inválidos e cobranças liquidadas com estornos ainda não conciliados bloqueiam o cálculo. Isso não define uma nova política de estorno. Não inferir tarifas atuais pelo plano nem incluir mensalidades sem classificação financeira conciliada como tarifa.

Este contrato e os sinalizadores locais não provam autorização ou liquidação. Integração real exige consulta administrativa no servidor, evidência da cobrança, competência/fuso, completude da paginação e origem única. O débito legado examinado em `on_service_completed.js` registra apenas o profissional e verifica duplicidade por serviço sem separar pagador; não deve ser usado como fonte completa para ambas as partes. Não alterado nesta etapa. Nenhum dado real foi importado ou cobrança disparada.

## Padrão vigente aprovado em 12/10/2026 — Pareto 80/20, progressão linear 10×

Esta decisão substitui a distribuição linear global aprovada em 09/10, descrita abaixo como histórico. Mantém ranking por pontos, avaliação média, antiguidade, teto de serviços, Grátis sem cashback e ESG mensal. Não adota regras do ERP LavaCar nem cria posição de rede por entrada.

N é o número de elegíveis, na ordem do ranking; K = ceil(N/5). Primeiro grupo recebe 80% e usa pesos inteiros 10(K−1)−9i, i=0..K−1 (equivalentes a progressão de 10 até 1). Segundo grupo recebe 20%, com pesos M..1, M=N−K. Grátis mantém sua posição geral e fica fora de N; a ordem entre elegíveis serve somente ao cálculo. Nenhum elegível: reserva não distribuída; um: 100% para ele. Quando K=1, seu peso é 1 e não existe razão interna de 10×.

Montante em centavos inteiros seguros. Grupo superior arredondado ao centavo mais próximo; inferior recebe o complemento. Maiores restos por grupo, desempate pela posição no ranking. A proporção 10× vale antes do arredondamento. Split não reaplicado; reduções ESG não redistribuídas. Política versionada `pareto-80-20-linear-10x-v1`.

Limitação matemática explícita: não é universal para toda combinação de N e montante. Com N=6, K=2, o 2º recebe 80%/11 e o 3º recebe 20%×4/10, invertendo posições. Montantes de poucos centavos também podem inverter a fronteira após arredondamento. A implementação rejeita o resultado inteiro se qualquer elegível posterior receber mais, em vez de alterar silenciosamente Pareto, 10× ou o ranking. São necessárias decisões futuras para liberar essas combinações; nenhuma fórmula alternativa foi aplicada.

Implementado no motor de conferência e telas que o utilizam. Não é fechamento financeiro ativo: backend, autorização e elegibilidade reais continuam pendentes de integração/homologação. Migrações e carteiras não foram alteradas.

## Média das avaliações — confirmação de 11/10/2026

Avaliação = soma de todas as notas recebidas / quantidade de avaliações, para cliente e parceiro. Zero participa da média. Somente sem avaliações usa 5 inicial. Não arredondar para estrelas inteiras; preservar decimais no cálculo. Hook de criação agora percorre todo o histórico por páginas de 500 e não corta a média em duas casas. Motor de simulação WELLNESS fixa avaliação exata mesmo ao receber um rascunho histórico arredondado. Valores de pontos usam precisão numérica JavaScript; valores financeiros continuam em centavos inteiros.

Pendente: homologação PocketBase real, revisão de edição/exclusão de avaliações e recálculo dos históricos já armazenados; não foi executada migração nem recálculo de produção.

## Antiguidade e avaliação confirmadas em 11/10/2026

Antiguidade = máximo(1, meses), sem teto de 10. Confirmação expressa do usuário: remover o teto. Avaliação de 0 a 5 estrelas; quem ainda não recebeu avaliação começa com 5. Grátis usa multiplicador 0 e soma apenas avaliação + antiguidade: iniciante = 6; com nota 5 e 24 meses = 29. Zero real não pode virar cinco. Pontos anteriores continuam acumulados separadamente.

Removido teto do motor TypeScript, cinco blocos dos hooks de ranking, backfill de tarifas e simulador administrativo legado. Estes últimos mantêm cálculo histórico por períodos de 30 dias; não foi alterado para aniversário de mês civil. A regra de antiguidade passa a integrar a chave de política da simulação, evitando mistura com resultados da versão anterior. Cadastros reais e valores padrão persistidos ainda exigem homologação para distinguir zero real de ausência de avaliação.

## Padrão de distribuição aprovado em 09/10/2026

O usuário aprovou expressamente a fórmula linear global como padrão, substituindo o corretor por níveis para os novos cálculos. Versão: `global-linear-v1`. Para N posições do ranking geral, peso da posição r = N − r + 1 se elegível, zero caso contrário. Cashback bruto = montante administrativo × peso / soma dos pesos elegíveis. N inclui Grátis; as posições não são renumeradas para pagamentos. Sem elegíveis, todo o montante permanece não distribuído. Centavos por maiores restos, desempate pela posição. ESG aplicado depois ao bruto mensal de cada participante. A aprovação da fórmula não ativa pagamentos nem define por si só indicação zero, critérios de elegibilidade ou destino das reduções ESG.

A área administrativa de conferência agora possui simulador linear paginado, com os dois exemplos aprovados. Prévia local independente: [369-wellness-cashback-linear.html](previews/369-wellness-cashback-linear.html), gerada do mesmo motor por `node scripts/build-linear-cashback-preview.cjs`. Sintaxe do JavaScript embarcado verificada; interação no navegador ainda não homologada. A simulação por níveis recebeu aviso de modelo histórico substituído. Os trechos abaixo que chamam a fórmula linear de proposta descrevem a etapa anterior e estão superados por esta aprovação.

## Decisões confirmadas

- Ranking único, decrescente pelo total de pontos: soma dos meses anteriores fechados + mês corrente. Desempate determinístico existente: avaliação, data de entrada e identificador. Atualização diária; resultado financeiro fixado no fechamento mensal. Não existe uma segunda posição por árvore/entrada. A data de entrada é somente critério secundário de desempate.
- Grátis recebe avaliação e antiguidade. Multiplicador zero zera apenas o produto plano × serviços × indicações. Participa do ranking e permanece inativo para cashback.
- PRO PARCEIRO mantém teto de 150 serviços antes dos multiplicadores.
- Cliente/parceiro deve visualizar seus próprios dados de aprovação, tarifas, pontos, posição, cashback e quantidade/histórico de serviços. Administrativo acessa os dados operacionais necessários de todos; outros usuários não recebem esses dados individualizados. Isso não concede automaticamente acesso administrativo a prontuários ou conteúdo clínico.
- SPLIT PADRÃO e configuração global da distribuição permanecem exclusivos do administrativo. Não confundir split interno com tarifa e valores próprios que devem ser transparentes para o participante.
- Cashback depende da posição no ranking e do total autorizado pelo administrativo. Cada posição elegível deve ter valor decrescente, com equalização uniforme.
- Orientação ESG: a partir de R$10.000, um projeto; R$15.000, dois; R$20.000, três. Dimensões econômica, social e ambiental. Referência recebida: parcela inicial de 55% e três parcelas de 15% cada. Regra posterior confirmada: base mensal e redução de 15 pontos percentuais por projeto exigido não cumprido, conforme tabela abaixo.

## Aplicação nesta entrega

Calculador de ranking corrigido para acumular avaliação/antiguidade do Grátis. O campo de elegibilidade é específico de cashback; não elimina a pessoa da ordenação. Testes anteriores foram atualizados para refletir a nova decisão, preservando transporte de centésimos, ordenação e teto aprovado.

Novo simulador isolado `cashbackLinearPreview.ts`: proposta de distribuição global linear. Recebe pool em centavos explicitamente, não deriva nem revela split administrativo. Usa o ranking validado/ordenado, conserva a única posição e dá peso zero a quem está inativo para cashback. Não verifica assinatura/conta real: as entradas ainda são simuladas e não autorizam pagamento.

Se N é o total de participantes no ranking e r a posição, peso(r) = N − r + 1 para elegíveis; zero para inativos. Cashback bruto(r) = pool × peso(r) / soma dos pesos elegíveis. O intervalo de pesos é constante por posição e a curva não introduz uma árvore financeira. Essa é uma proposta nova, não a mesma curva de equalização por níveis do documento anterior; o simulador legado permanece disponível sem mudança financeira silenciosa.

Exemplo ilustrativo: quatro posições elegíveis e pool de R$1.000 resultam em R$400, R$300, R$200 e R$100. Se a primeira for Grátis, ela mantém posição 1 e recebe zero; o pool é dividido pelas posições 2, 3 e 4 com pesos 3, 2 e 1. Esse exemplo não é promessa de cashback.

Cálculo usa inteiros/BigInt e método dos maiores restos, com desempate pela posição, para distribuir exatamente os centavos. Valores são não crescentes entre elegíveis. Quando o pool é pequeno frente ao número de pessoas, valores iguais ou zero podem ser inevitáveis: não é possível prometer diferença estrita entre todas as posições em qualquer cenário com moeda limitada a centavos. Nenhum elegível implica pool não alocado, não pagamento ao último participante.

ESG: helper usa exclusivamente base mensal confirmada. O cálculo de prévia aplica redução de 15% do cashback bruto mensal por projeto exigido não cumprido. Não bloqueia/libera dinheiro real nem aprova projetos. O exemplo monetário fornecido contém arredondamentos independentes que podem somar centavos a mais: o fechamento deve conservar o total, jamais somar parcelas arredondadas sem conciliação.

## ESG mensal — regra confirmada em 08/10/2026 às 11:33 (São Paulo)

A resposta do usuário substitui a proposta anterior de 45% por um projeto ou 22,5% por projeto. Cada projeto exigido NÃO cumprido reduz 15 pontos percentuais do total bruto mensal. Todos cumpridos significam 100%.

| Cashback bruto mensal | Exigidos | Nenhum cumprido | 1 cumprido | 2 cumpridos | 3 cumpridos |
| --- | ---: | ---: | ---: | ---: | ---: |
| Abaixo de R$10.000 | 0 | 100% | 100% | 100% | 100% |
| R$10.000 a menos de R$15.000 | 1 | 85% | 100% | 100% | 100% |
| R$15.000 a menos de R$20.000 | 2 | 70% | 85% | 100% | 100% |
| R$20.000 ou mais | 3 | 55% | 70% | 85% | 100% |

Fórmula: faltantes = máximo(0, exigidos − cumpridos); redução = bruto mensal × 15% × faltantes. A faixa usa o valor bruto anterior à redução e não é recalculada sobre o líquido. Sem efeito em pontos/posição do ranking. Grátis continua inativo para cashback antes da etapa ESG; esta função recebe apenas o montante de participante elegível.

Arredondamento da redução agregada uma única vez, ao centavo mais próximo (meio centavo para cima); líquido é a diferença exata para o bruto. Não arredondar várias parcelas independentemente. Isso pode diferir em um centavo dos exemplos da planilha, mas nunca cria dinheiro. Exemplo R$36.958,50 sem projetos: redução de R$16.631,33 e líquido de R$20.327,17.

`calculateMonthlyEsgPreview` implementa a regra somente como simulação. Quantidade cumprida deverá vir de registros de aprovação confiáveis do servidor, nunca de um número enviado pelo cliente para resgate. Critérios de aprovação, categorias distintas/validade e destino dos valores reduzidos continuam pendentes; não há redistribuição automática, transferência ou receita apropriada ao admin.

Zero indicações, validação de indicações, estornos e instante/fuso de corte continuam sem nova decisão explícita. Não usar as opções atuais de simulação como política financeira automaticamente aprovada.

## Verificação da referência jurídica

A referência do arquivo estava incorreta. A Lei 13.887, de 17/10/2019, altera regras de proteção da vegetação nativa, Cadastro Ambiental Rural e regularização ambiental; não é uma lei de validação de marketing multinível ou deste cashback.
Fonte oficial: https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13887.htm

O boletim CVM/Senacon distingue remuneração sustentada principalmente por vendas reais de estruturas que captam recursos de novos integrantes para pagar participantes anteriores. Logo, ter ranking, rede global ou chamar um pagamento de cashback não determina sozinho o enquadramento jurídico. A análise precisa considerar operação efetiva, origem da receita e comunicação/oferta. Esta checagem documental não certifica a legalidade do modelo; o regulamento e o fluxo financeiro precisam de revisão jurídica específica antes de lançamento financeiro.
Fonte oficial: https://www.gov.br/mj/pt-br/assuntos/seus-direitos/consumidor/boletins-para-o-consumo/boletim-consumidor-investidor/anexos/boletim_cvm_senacon_6.pdf

## Validação e limites

206 testes locais aprovados: 163 helpers/SDK/controllers Supabase com mocks, 39 cálculos ranking/cashback/CSV/ESG e 4 contratos da migration PocketBase. TypeScript, build, lint dos módulos novos/alterados e diff check aprovados.

Sem novas migrations, alteração de dados reais, publicação, transferência ou crédito. A migration 0065 do split continua preparada e não aplicada em PocketBase real. A visibilidade proprietário + administrativo está registrada; painel/API administrativa consolidada, atualização diária no servidor e snapshots mensais continuam pendentes. A proposta linear ainda não está ligada às telas nem ao fechamento financeiro. Todos os pacotes 0–15 permanecem parciais.

Prévia demonstrativa existente, ainda sem estas alterações: https://wellness-369-demo.ademariom07.chatgpt.site


## Conferência disponível na branch

A área administrativa de rascunhos contém agora a simulação mensal ESG com entrada manual e comparação de todos os cenários da faixa. Não está conectada a saldos ou aprovação real. Uma prévia independente está em [369-wellness-esg.html](previews/369-wellness-esg.html); sem publicação do aplicativo. Não confundir com a proposta de distribuição linear global, que permanece isolada e sem ativação financeira.
