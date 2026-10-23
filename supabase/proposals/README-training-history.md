# Histórico de treinos — aplicado em 23/10/2026

Migração Supabase: 20261023212916_preserve_student_training_history, aplicada após autorização explícita do proprietário. Proposta abaixo preservada como referência; não reaplicar (a policy já existe).

O destinatário mantém leitura dos treinos e conclusões anteriores e pode marcar seus avisos como lidos. O antigo profissional perde acesso; outro profissional não herda o histórico automaticamente. Publicação e conclusão ainda exigem vínculo ativo da mesma versão. A tela identifica histórico como somente consulta e não oferece conclusão em vínculo encerrado ou renovado.

Validação após aplicação: 31 verificações de treinos, 16 de conclusões e 12 de histórico passaram em transações revertidas. 27 testes TypeScript passaram, além de tsc e build de acesso. Confirmados 3 usuários, 3 perfis e nenhum vínculo/treino/conclusão fictício persistido. Advisor sem novo alerta de segurança; permanece aviso anterior sobre senhas vazadas.

Arquivos definitivos: supabase/migrations/20261023212916_preserve_student_training_history.sql; supabase/tests/protected_training_plans.sql; supabase/tests/training_completion_records.sql; supabase/tests/training_recipient_history.sql.

Limite: verificação SQL e testes de cliente não substituem homologação com sessões reais no navegador. A checagem visual do histórico usa o vínculo carregado; revogação ocorrida em outra sessão continua sujeita à negativa autoritativa do servidor até atualizar a conta. Operação financeira e quotas de IA não fazem parte desta entrega.
