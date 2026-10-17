# YouTube no Supabase — preparação de piloto administrativo

Data: 16/10/2026. Piloto implantado no Supabase: exercise-video-search, versão 1, ACTIVE, verify_jwt=true. Frontend não publicado. Nenhuma chave lida, copiada ou versionada.

## Evidências e decisão

O agente atual é `pocketbase/hooks/exercise_video_search.js` e usa `$ai.chat` no runtime Skip. O login das telas principais continua em `src/contexts/AuthContext.tsx`, via PocketBase. O cliente Supabase é opcional e possui sessão independente. Uma chave em Secrets do Supabase não fica disponível ao processo PocketBase.

A nova função `supabase/functions/exercise-video-search` é um piloto administrativo de obtenção de candidatos, não substitui nem desativa o agente atual. Busca candidatos e usa OpenAI Responses API com saída JSON estrita para selecionar um ID existente ou null. Modelo fixado gpt-4.1-mini-2025-04-14, store=false; segredo OPENAI_API_KEY somente no servidor. Retorna video/message, sem confirmar adequação clínica nem modificar treinos. Não chama IA quando não há candidatos; falhas não selecionam automaticamente o primeiro vídeo.

## Proteções implementadas

- POST com Bearer token, verificado online em Supabase Auth; usuários anônimos recusados.
- Papel admin consultado no perfil do banco sob a sessão/RLS do usuário, nunca em user_metadata.
- Sem service_role no código. Sem credenciais nas URLs, logs ou erros devolvidos.
- Corpo lido com limite de 1 KiB, nome de exercício limitado a 160 caracteres; demais campos não seguem ao YouTube.
- Destino fixo Google, redirecionamentos recusados e timeout de 12 segundos por consulta.
- Filtragem de ID, privacidade, incorporação, processamento, transmissão ao vivo, idade, região BR e duração de 20 a 900 segundos.
- Máximo de três buscas por instância durante sua vida. Isto NÃO é limite global: reinícios/réplicas permitem novas buscas. Não liberar para alunos sem quota compartilhada persistente e controle global de consumo.
- Sem CORS neste piloto: destinado a teste administrativo por ferramenta HTTP, não a chamada direta do navegador.

## Implantação e validação ainda necessárias

1. Preservar `verify_jwt=true` ao implantar. O handler também verifica o usuário. Não desligar verificações para contornar incompatibilidade de sessão.
2. Confirmar conta real de administrador Supabase, sem promover automaticamente ninguém. Na última consulta as tabelas estavam vazias.
3. Realizar teste autenticado com a chave já salva pelo titular; validar ausência de token, conta de aluno e administrador. A simples presença da chave não prova sua validade/restrições/quota.
4. Provedor OpenAI implementado. Validar credencial, saldo/permissão do modelo e busca real em sessão administrativa. A declaração de chave salva pelo usuário não comprova que a API aceitou uma chamada.
5. Implementar quota distribuída antes de liberar acesso às contas de alunos/profissionais; definir integração de identidade PocketBase/Supabase, sem enviar token de um provedor ao outro como se fosse equivalente.
6. Só então adaptar cartões/status administrativo e homologar no navegador. Sem publicação da aplicação ou migração de login nesta entrega.

## Validação local

20 testes simulados passaram (incluindo seleção válida/null, IDs inventados, JSON inválido, resposta incompleta/recusa e erros do provedor). TypeScript do aplicativo aprovado. Os testes iniciais cobrem: ausência/invalidez de autenticação, usuário sem papel administrativo, parâmetros inválidos, corpo excessivo, chave ausente, limite atingido, erro de provedor sem vazamento e filtragem dos candidatos. Não comprovam Deno/Edge runtime, RLS real, sessão real, quota global ou conexão ao YouTube.

Referências: https://supabase.com/docs/guides/functions/auth e https://supabase.com/docs/guides/functions/secrets.

## Continuidade — painel autenticado e navegador

Consulta agregada ao banco confirmou zero usuários Auth, zero perfis e zero administradores. É necessário cadastrar e identificar a conta responsável antes da homologação; nenhuma conta foi criada ou promovida automaticamente.

Painel `SupabaseVideoPilot` preparado em `/conta-supabase`, visível somente para admin, usando a sessão Supabase existente. Descarte de resposta após mudança de sessão, bloqueio local de duplicação, validação do ID/URL e iframe somente após clique. Nenhuma chamada automática aos provedores.

CORS por lista exata de origens HTTPS em `VIDEO_ALLOWED_ORIGINS` (separadas por vírgula), padrão somente `https://wellness-369-demo.ademariom07.chatgpt.site`. Isso não dispensa login ou autorização. Uma futura publicação da tela React em outra origem requer configurar sua origem exata. Não usar wildcard. Painel React somente na branch; a prévia estática continua demonstrativa.

26 testes locais simulados e TypeScript aprovados. Nenhuma busca real autenticada foi executada. Limite por instância continua insuficiente para liberação geral.
