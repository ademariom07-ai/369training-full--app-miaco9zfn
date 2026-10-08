/// <reference path="../pb_data/types.d.ts" />

migrate(
  (_app) => {
    // Migração efêmera 0094 de teste SMTP Brevo concluída.
    // O envio foi disparado para ademariom07@gmail.com via smtp-relay.brevo.com:587.
    // Retorno registrado nos logs de e-mail do PocketBase: 525 "5.7.1 Unauthorized IP address"
    // Mantida sem operações ativas para integridade e imutabilidade do histórico.
  },
  (_app) => {},
)
