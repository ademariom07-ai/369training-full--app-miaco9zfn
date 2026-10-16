# YouTube no Supabase — preparação de piloto administrativo

Data: 16/10/2026. Código preparado, não implantado. Nenhuma chave lida, copiada ou versionada.

## Evidências e decisão

O agente atual é `pocketbase/hooks/exercise_video_search.js` e usa `$ai.chat` no runtime Skip. O login das telas principais continua em `src/contexts/AuthContext.tsx`, via PocketBase. O cliente Supabase é opcional e possui sessão independente. Uma chave em Secrets do Supabase não fica disponível ao processo PocketBase.

A nova função `supabase/functions/exercise-video-search` é um piloto administrativo de obtenção de candidatos, não substitui nem desativa o agente atual. Retorna `candidates` e `selectionStatus: pending_ai_review`; o contrato não é o mesmo da busca antiga e não pode ser ligado diretamente aos cartões. Não usa IA, não confirma a adequação clínica nem modifica treinos.

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
4. Definir o provedor de IA e sua credencial de servidor. `$ai.chat` não existe automaticamente no Supabase. O modelo deverá selecionar exclusivamente um ID dos candidatos ou recusar.
5. Implementar quota distribuída antes de liberar acesso às contas de alunos/profissionais; definir integração de identidade PocketBase/Supabase, sem enviar token de um provedor ao outro como se fosse equivalente.
6. Só então adaptar cartões/status administrativo e homologar no navegador. Sem publicação da aplicação ou migração de login nesta entrega.

## Validação local

11 testes simulados passaram: ausência/invalidez de autenticação, usuário sem papel administrativo, parâmetros inválidos, corpo excessivo, chave ausente, limite atingido, erro de provedor sem vazamento e filtragem dos candidatos. Não comprovam Deno/Edge runtime, RLS real, sessão real, quota global ou conexão ao YouTube.

Referências: https://supabase.com/docs/guides/functions/auth e https://supabase.com/docs/guides/functions/secrets.
