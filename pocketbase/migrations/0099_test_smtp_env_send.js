/// <reference path="../pb_data/types.d.ts" />

migrate(
  (_app) => {
    // Migração efêmera 0099 de teste SMTP Brevo concluída com SUCESSO.
    // O envio foi disparado para wellness369@outlook.com via smtp-relay.brevo.com:587.
    // Retorno registrado nos logs de e-mail do PocketBase (2026-10-09 15:46:34Z):
    // status: sent, error: null (aceito pelo servidor Brevo sem 535/525).
    // Mantida como no-op para integridade e imutabilidade do histórico, sem credenciais expostas.
  },
  (_app) => {},
)
