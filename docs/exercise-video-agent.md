# Agente de vídeos de exercícios — 369 WELLNESS

Implementação em `prep/supabase-vite`, sem publicação. O profissional informa nome, equipamento e variação no nome do exercício; não precisa selecionar nem colar um vídeo. Os cartões do profissional e do aluno buscam automaticamente quando entram na tela. O acesso do aluno mantém a condição Pro/Premium existente. A busca não altera prescrição, carga ou aprovação de treino.

## Fluxo

`POST /backend/v1/exercises/video-search`, autenticado, recebe `{ "exercise": "Agachamento com halteres" }`. Somente esse nome é enviado aos provedores; não envia cadastro nem anamnese. YouTube Data API v3 pesquisa até dez vídeos com preferência por português e região BR, SafeSearch estrito e incorporação permitida. `videos.list` confirma público, processado, incorporável, sem transmissão ao vivo/restrição etária conhecida/bloqueio BR, duração de 20 segundos a 15 minutos. O modelo seleciona um ID existente ou recusa a seleção. Não gera URLs livres. Títulos e descrições são tratados como dados não confiáveis.

O cartão mostra título, canal, link externo para o YouTube e identificação de sugestão automática. A análise usa metadados: não assiste ao vídeo, não confirma credenciais nem certifica adequação clínica. Sem correspondência ou indisponibilidade, a interface informa o estado; nenhum vídeo fictício é inserido. Links antigos deixam de ser a fonte desses cartões. Alterar o exercício descarta a resposta anterior na interface.

## Ativação no servidor

1. Habilitar YouTube Data API v3 no projeto Google Cloud e configurar `YOUTUBE_DATA_API_KEY` no ambiente do processo PocketBase. Restringir a chave à API e aos IPs de saída do servidor quando disponíveis. Nunca usar prefixo `VITE_`, versionar credenciais ou colocá-las no navegador. Não é necessário login YouTube do aluno.
2. Manter o provedor `$ai.chat` configurado no runtime atual. A seleção falha explicitamente se o modelo falhar; não há aprovação silenciosa de resultado.
3. Instalar o hook seguindo o mesmo carregador dos demais arquivos `pocketbase/hooks`. A implantação atual usa nomes `.js`; PocketBase puro requer o diretório e sufixo `.pb.js` de seu carregador padrão.
4. Configurar limite de requisições para esse endpoint no gateway/PocketBase antes de habilitar em produção (sugestão inicial: 20/minuto por usuário e limite global alinhado à quota da API). O cache e a fila do navegador não substituem controle de abuso no servidor. Monitorar quota/custo das buscas e do modelo sem registrar chaves ou respostas brutas dos provedores.
5. Validar no ambiente autenticado buscas de exercícios com equipamentos diferentes, ausência de correspondência, API sem quota, mudança rápida de exercício e vídeo removido. Busca real depende da chave e da rede do servidor.

Cache em memória por processo: até 256 entradas; positivos por 6 horas, ausência por 10 minutos. Não persiste dados clínicos, não compartilha cache entre réplicas e não oferece exclusão mútua para misses simultâneos. O navegador serializa e deduplica buscas por usuário por 5 minutos. Disponibilidade pode mudar após a consulta; o link abre no YouTube, que aplica suas restrições atuais. Revisões de segurança clínica e limites de gerações de treino permanecem no fluxo existente; esta busca auxiliar não gera nova prescrição.

## Fontes técnicas

- https://developers.google.com/youtube/v3/docs/search/list
- https://developers.google.com/youtube/v3/docs/videos
- https://pocketbase.io/docs/js-sending-http-requests/

Testes automatizados simulam respostas de YouTube e do modelo. Não equivalem a validação ao vivo ou revisão do conteúdo audiovisual.
