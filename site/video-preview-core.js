(function(root){'use strict';const api={
  label(value){const text=String(value||'').trim().replace(/\s+/g,' ');if(!text||text.length>160)throw Error('Informe um exercício de até 160 caracteres.');return text},
  youtubeUrl(value){return 'https://www.youtube.com/results?search_query='+encodeURIComponent(api.label(value)+' execução técnica exercício')},
  duration(value){const n=Number(value);return Number.isInteger(n)&&n>=5&&n<=600?n:60},
  outcome(scenario){if(scenario==='none')return {title:'Nenhuma correspondência clara',text:'Neste cenário, a IA não sugere um vídeo. O exercício permanece como prescrito.'};if(scenario==='error')return {title:'Busca temporariamente indisponível',text:'Neste cenário, o serviço não respondeu. Nenhum resultado é inventado e o treino permanece acessível.'};return {title:'Espaço da demonstração selecionada',text:'Aqui aparecerá o vídeo escolhido entre os resultados do YouTube. Esta prévia não fez uma busca real nem carregou um vídeo.'}}
};root.VideoPreview=api;if(typeof module!=='undefined')module.exports=api;})(globalThis);
