# Histórico de treinos — proposta de 23/10/2026

Estado: preparada e testada em transações revertidas; aplicação persistente bloqueada pela aprovação automática. A política de produção permanece inalterada.

Objetivo: preservar leitura do treino recebido e da conclusão para o destinatário após encerramento/troca de vínculo ou perda de aprovação do profissional. Permitir marcar seu próprio aviso como lido. Não ampliar acesso do antigo ou novo profissional, de outros alunos, administradores ou anônimos. Publicação e conclusão continuam exigindo vínculo ativo pela função existente.

Teste realizado: SQL proposto + protected_training_plans (31) e training_completion_records (16) em transação revertida; SQL proposto + training_recipient_history (12) em outra transação revertida. Total: 59 verificações aprovadas. Não constitui homologação de navegador ou de tokens Auth reais.

Os arquivos em proposals/tests substituem as expectativas históricas somente após aplicar a proposta. Nenhuma migração foi registrada. Próximo passo: autorização específica para aplicar a política no Supabase, registrar a versão gerada, substituir os testes anteriores, repetir as verificações no estado aplicado e ajustar a interface para identificar treinos históricos como consulta, sem oferecer conclusão após encerramento.
