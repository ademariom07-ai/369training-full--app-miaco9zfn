# Procedimento Operacional: Desbloqueio e Purga de Histórico Git (GitHub Push Protection)

Este guia documenta e fornece o script automatizado para purgar chaves e credenciais revogadas (especialmente chaves SMTP Brevo no formato `xsmtpsib-...`) de todo o histórico do Git e realizar o sincronismo com o GitHub usando `git-filter-repo`.

---

## 1. Por que esta operação é necessária localmente / no ambiente do operador?

O agente autônomo opera dentro do contêiner isolado da aplicação Skip Cloud (onde apenas ferramentas de edição de código do app, migrações e banco de dados estão expostas, sem acesso ao shell interativo do sistema operacional nem ao executável `git push --force` com credenciais SSH/HTTPS de gravação do GitHub).

Por esse motivo, a reescrita do histórico com **`git-filter-repo`** e o **`git push --force`** são executados no seu terminal local (onde você tem o clone do repositório `github.com/ademariom07-ai/369training-full--app-miaco9zfn` e as chaves de acesso ao GitHub).

---

## 2. Opções de Resolução

### Opção A: Bypassar a Push Protection pelo link gerado pelo GitHub (Mais rápida - 1 minuto)

Como a chave Brevo **já foi revogada** no painel da Brevo, o próprio GitHub oferece uma forma imediata e oficial de desbloquear o push:

1. Ao rodar `git push origin main`, o GitHub retorna uma mensagem com um link de liberação exclusivo para o proprietário do repositório:
   ```text
   remote: Push cannot contain secrets
   remote:   - Brevo SMTP Key: ...
   remote: To bypass push protection, visit:
   remote: https://github.com/ademariom07-ai/369training-full--app-miaco9zfn/security/secret-scanning/unblock-secret/...
   ```
2. Abra esse link no seu navegador conectado à conta `ademariom07-ai`.
3. Selecione a opção **"Revoked secret"** (ou "It's a false positive / revoked") e confirme o unblock.
4. Rode `git push origin main` novamente. O push será aceito de imediato.

---

### Opção B: Purgar o histórico com `git-filter-repo` e Force Push (Recomendada para sanitização total)

Execute a sequência de comandos abaixo no seu terminal local:

#### Passo 1: Instalar o git-filter-repo

```bash
# macOS
brew install git-filter-repo

# Linux / Ubuntu / Debian
sudo apt-get update && sudo apt-get install -y git-filter-repo
# ou via pip:
pip install git-filter-repo

# Windows (via pip ou scoop)
pip install git-filter-repo
```

#### Passo 2: Clonar o repositório em uma pasta limpa (backup)

```bash
git clone https://github.com/ademariom07-ai/369training-full--app-miaco9zfn.git repo-cleanup
cd repo-cleanup
```

#### Passo 3: Criar arquivo de substituição de expressões para o filter-repo

Crie um arquivo chamado `expressions.txt`:

```bash
cat << 'EOF' > expressions.txt
regex:xsmtpsib-[A-Za-z0-9_-]+==>[REMOVIDO]
EOF
```

#### Passo 4: Executar a reescrita de histórico em todos os branches e tags

```bash
git-filter-repo --replace-text expressions.txt --force
```

#### Passo 5: Reidratar o remote origin (o filter-repo desconecta o remote por precaução)

```bash
git remote add origin https://github.com/ademariom07-ai/369training-full--app-miaco9zfn.git
```

#### Passo 6: Verificar se ainda resta algum vestígio no histórico

```bash
git log -S "xsmtpsib" --all
# (Deve retornar vazio, confirmando que todos os commits foram sanitizados)
```

#### Passo 7: Forçar a atualização da branch main e das tags no GitHub

```bash
git push origin main --force --tags
```

---

## 3. Estado Atual do Código

No estado atual do repositório (versão **v0.0.162**):

- Nenhuma chave SMTP/Brevo em texto claro existe nos arquivos atuais (`pocketbase/hooks/smtp_settings.js` usa estritamente `$os.getenv('SMTP_PASSWORD')`).
- Nenhuma chave está em arquivos `.env` commitados.
- Todo o código da aplicação e migrações permanece 100% intacto.
