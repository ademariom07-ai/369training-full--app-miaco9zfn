/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Sanitização de E-mails Transacionais:
 * Garante que nenhuma mensagem de verificação ou troca de senha exponha
 * tokens JWT em texto cru/plano no corpo da mensagem.
 * Mantém exclusivamente o link/botão HTML clicável com {APP_URL}/.../{TOKEN}.
 */

onMailerBeforeRecordResetPasswordSend((e) => {
  try {
    // Se houver mensagem de texto simples (plain-text) com token cru,
    // substitui para mensagem de orientação sem vazar o JWT
    if (e.message && e.message.text) {
      // Remove tokens JWT isolados do texto plano se presentes
      e.message.text = e.message.text.replace(
        /eyJ[a-zA-Z0-9_\-.]+/g,
        '[Utilize o link com segurança no seu aplicativo]',
      )
    }

    // No HTML, se o token estiver solto no texto (fora de href="..."), remover
    if (e.message && e.message.html) {
      // Se algum cliente de e-mail renderizou o token em texto visível:
      // Ex: >eyJhbGci...< ou texto solto
      e.message.html = e.message.html.replace(
        />(\s*)eyJ[a-zA-Z0-9_\-.]+(\s*)</g,
        '>$1[Token protegido]$2<',
      )
    }
  } catch (err) {
    console.warn('[clean_mailer] Erro ao sanitizar reset password mail:', err)
  }
})

onMailerBeforeRecordVerificationSend((e) => {
  try {
    if (e.message && e.message.text) {
      e.message.text = e.message.text.replace(
        /eyJ[a-zA-Z0-9_\-.]+/g,
        '[Utilize o link de confirmação no seu aplicativo]',
      )
    }

    if (e.message && e.message.html) {
      e.message.html = e.message.html.replace(
        />(\s*)eyJ[a-zA-Z0-9_\-.]+(\s*)</g,
        '>$1[Token protegido]$2<',
      )
    }
  } catch (err) {
    console.warn('[clean_mailer] Erro ao sanitizar verification mail:', err)
  }
})
