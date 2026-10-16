# Procedimento de Desbloqueio da Push Protection do GitHub

O GitHub Push Protection bloqueou a sincronização com o repositório remoto devido à detecção de chaves SMTP Sendinblue/Brevo em commits antigos do histórico.

---

## Links Oficiais de Desbloqueio (Unblock)

Como as chaves já foram devidamente revogadas no painel da Brevo, o método mais imediato para liberar a sincronização do repositório no GitHub sem riscos é autorizar o bypass através dos links exclusivos de unblock gerados pelo GitHub:

1. **Commit `ede16d7` (`.env`)**:
   👉 [Desbloquear segredo 1](https://github.com/ademariom07-ai/369training-full--app-miaco9zfn/security/secret-scanning/unblock-secret/3KjoyGJrOqr3EDRtmutpN0qGKM3)

2. **Commit `bfacd65` (`.env`)**:
   👉 [Desbloquear segredo 2](https://github.com/ademariom07-ai/369training-full--app-miaco9zfn/security/secret-scanning/unblock-secret/3KkT9VYxBVLR75tyQ7jOZmHnhfh)

3. **Commit `76225ad` (`.env`)**:
   👉 [Desbloquear segredo 3](https://github.com/ademariom07-ai/369training-full--app-miaco9zfn/security/secret-scanning/unblock-secret/3KkT9Ru8Bh6ccAiwKkbvnMU9tYi)

4. **Commits `88a817f` e `531849b` (`.env` e `pocketbase/hooks/smtp_settings.js`)**:
   👉 [Desbloquear segredo 4](https://github.com/ademariom07-ai/369training-full--app-miaco9zfn/security/secret-scanning/unblock-secret/3KkT9XW0iwEezzhKI5tFwKHAJV2)

### Status da Sincronização

Última checagem de sincronização e integridade realizada para a versão v0.0.164.

### Instruções para desbloquear:

1. Abra cada um dos 4 links acima no seu navegador (conectado à sua conta `ademariom07-ai`).
2. Selecione a opção **"Revoked secret"** (ou "It's used in tests / false positive").
3. Clique em **"Allow me to push this secret"**.
4. Uma vez autorizados os 4 links, a próxima sincronização com o GitHub ocorrerá normalmente.

---

## Alternativa: Purga Completa com `git-filter-repo` no Terminal

Se preferir reescrever todo o histórico para remover permanentemente qualquer vestígio de `xsmtpsib-...` do repositório:

```bash
# 1. Clonar o repositório
git clone https://github.com/ademariom07-ai/369training-full--app-miaco9zfn.git repo-purge
cd repo-purge

# 2. Criar regra de substituição de todas as chaves Brevo antigas
cat << 'EOF' > replace.txt
regex:xsmtpsib-[A-Za-z0-9_-]+==>[REMOVIDO]
EOF

# 3. Executar o git-filter-repo
git-filter-repo --replace-text replace.txt --force

# 4. Readicionar a URL remota de origem
git remote add origin https://github.com/ademariom07-ai/369training-full--app-miaco9zfn.git

# 5. Fazer o force-push para o GitHub
git push origin main --force --tags
```
