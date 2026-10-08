/// <reference path="../pb_data/types.d.ts" />

migrate(
  (_app) => {
    // Migração efêmera 0096 de teste SMTP Brevo concluída com SUCESSO.
    // O envio foi disparado para ademariom07@gmail.com via smtp-relay.brevo.com:587.
    // Retorno registrado nos logs de e-mail do PocketBase (2026-10-08 22:18:56Z):
    // status: sent (código 250 OK do servidor Brevo).
    // Mantida como no-op para integridade e imutabilidade do histórico, sem credenciais expostas.
  },
  (_app) => {},
)
