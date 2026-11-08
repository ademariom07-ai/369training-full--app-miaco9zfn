# 369 WELLNESS — preparação do piloto privado
Data: 08/11/2026. Este roteiro não autoriza publicação externa nem movimentação financeira.

## Evidências desta entrega
- Site reconferido: ativo, versão 54, acesso somente ao proprietário, zero visitantes externos.
- Branch operacional remota conferida antes da entrega: prep/supabase-vite em 5a3b78c42016afca7c8aac8259102f0a7fe03b91.
- Novo comando: `node scripts/qa/release-preflight.mjs`. Commit ceb70985560246393eeb89c491b46469f4aca10e.
- Executado no checkout local preservado: 478 testes em 52 arquivos, TypeScript e build operacional aprovados.
- Primeira execução falhou por ausência local de jsdom. Restaurado com pnpm install --frozen-lockfile --ignore-scripts; nova execução integral aprovada.
- Verificador do pacote local existente do Site: 5 testes aprovados, 71 arquivos e 77 referências válidas.
- Limites: checkout local contém alterações históricas; não foi comprovada igualdade integral com a branch remota. O pacote existente do Site não foi substituído pelo build recém-gerado. Não houve teste autenticado, migração, publicação nem alteração de dados.
- Build: JavaScript 661,65 kB (187,83 kB gzip); otimização de desempenho pendente. /brand.css é fornecido pelo pacote do Site e não pelo build de acesso isolado. Preservar essa etapa na montagem de qualquer candidato.

## Sequência de aceite com contas reais
Todos os passos abaixo estão PENDENTES. Usar contas de teste autorizadas, identificadas no relatório por papel, nunca por senha/token. O login da hospedagem e o login Supabase são camadas distintas. Não ampliar visitantes para contornar a proteção.

| Passo | Ação | Resultado exigido |
| --- | --- | --- |
| 1 | Login, recarga, recuperação e logout por papel | Sessão persiste corretamente; logout revoga acesso; aluno não abre ações administrativas. |
| 2 | Aluno A e aluno B consultam o mesmo recurso pela interface e API | B não acessa o recurso de A; registrar resultado sem conteúdo pessoal. |
| 3 | Profissional aprovado convida/vincula aluno com consentimento | Vínculo não surge sem aceite; profissional pendente não recebe privilégios. |
| 4 | Profissional cria, revisa e entrega treino ao aluno A | A recebe; B não recebe; plano continua após sair e entrar. |
| 5 | Aluno A registra execução; profissional acompanha | Registro persistente; repetição não gera duplicação indevida. |
| 6 | Admin configura temporariamente prazo de reserva em ambiente de teste; profissional libera dia | Somente horários liberados aparecem; configuração tem trilha de auditoria. |
| 7 | A e B tentam reservar o mesmo horário simultaneamente | Um vencedor; outro recebe indisponibilidade; identidade de terceiro não é exposta. |
| 8 | Titular cancela; outro pedido expira | Horário liberado após transição; nenhuma confirmação de pagamento ou cobrança fictícia. |
| 9 | IA e vídeos, caso sejam expostos no piloto | Consentimento, quota no servidor, revisão exigida e erros tratados; caso contrário, não anunciar módulo como operacional. |

Para cada passo registrar: versão/commit, ambiente, data, papel, resultado esperado/observado e evidência sanitizada. Usar dados fictícios somente no ambiente de teste, sem cobranças ou créditos reais. Preservar os identificadores necessários à limpeza controlada; nunca excluir registros por filtros amplos.

## Preparação de recuperação e suporte
1. Identificar backup disponível, retenção e procedimento de restauração sem exportar dados pessoais para documentos.
2. Executar recuperação em ambiente isolado; comparar integridade e registrar tempo medido. Roteiro escrito não comprova restauração.
3. Definir canal de suporte, responsável e monitoramento antes de convidar participantes; ainda não definidos nesta entrega.
4. Definir critérios de interrupção: acesso indevido, treino entregue a destinatário errado, dupla reserva, erro persistente de sessão ou lançamento financeiro indevido.

## Reversão
- Antes de qualquer publicação futura, registrar versão anterior do Site e commit, configurações administrativas vigentes e compatibilidade do esquema.
- Em falha crítica, interromper convites; pausar novas reservas pela configuração administrativa se aplicável; preservar registros/auditoria.
- Reimplantar versão anterior compatível somente por procedimento autorizado de publicação. Reversão do frontend não desfaz alterações do banco.
- Não executar down migrations, excluir tabelas ou restaurar produção automaticamente. Recuperação de dados depende do ensaio isolado e decisão específica.
- Este procedimento foi preparado, não executado.

## Critério de liberação
Piloto fechado: aceites de identidade, isolamento, jornada, módulos expostos, privacidade, recuperação e suporte comprovados. Operação financeira: adicionalmente provedor integrado, eventos autenticados/idempotentes, estornos e conciliação. Nenhum dos dois está certificado nesta entrega.

Prévia privada preservada: https://wellness-369-demo.ademariom07.chatgpt.site/acesso.html
