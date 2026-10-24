# Homologação de aprovações e vínculos — 24/10/2026

## Resultado deste ciclo

| Suíte SQL existente | Verificações | Resultado |
| --- | ---: | --- |
| professional_applications.sql | 30 | Passou |
| participant_link_summary.sql | 22 | Passou |
| approved_professional_directory.sql | 15 | Passou |

As três suítes foram executadas com papéis SQL e claims controlados no Supabase elahjmtboqhqqxmoaths e revertidas ao final. Cobrem tentativa de autopromoção, aprovação administrativa e auditoria, credenciais privadas, paginação, nomes de participantes, revogação e acessos anônimos. Não substituem tokens emitidos pelo Auth nem sessões de navegador.

Cliente: 29 testes passaram em applications.test.ts, participantLinks.test.ts e directory.test.ts. Incluem mudança de sessão, resposta malformada, recusa do servidor e limites de paginação.

Conferência final: 3 usuários Auth, 3 perfis, 1 profissional de Educação Física aprovado, zero vínculos, zero treinos e zero conclusões persistidos. Nenhum usuário fictício permaneceu. A credencial da conta profissional de teste não foi validada como habilitação real.

Sites confirmou versão 40 ativa no endereço privado. Não houve nova publicação ou alteração de regra neste ciclo.

## Bloqueio da homologação visual

O navegador chegou à autenticação do proprietário na sessão anterior, mas a solicitação segura foi interrompida. Nesta retomada a referência da sessão não estava disponível; nenhuma autenticação concluída foi presumida e nenhuma senha foi solicitada no chat.

## Próxima evidência necessária

Com sessões reais e distintas: aluno solicita vínculo com profissional aprovado; profissional aceita; profissional publica orientação de teste sem prescrição real; aluno lê e registra conclusão; profissional visualiza conclusão; após logout/login os dados permanecem; terceiro não acessa. Estes passos ainda não foram comprovados no navegador. Não declarar etapas 2 e 3 integralmente homologadas.
