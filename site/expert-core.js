'use strict';
const ExpertCore=(()=>{
const EXPERTS=Object.freeze([
 Object.freeze({id:'mentor-expansao-369',name:'Mentor de Expansão 369',description:'Organização de objetivos de marketing, carreira e retenção.',formats:Object.freeze(['Plano semanal','Retenção','Marketing'])}),
 Object.freeze({id:'roteirista-saude-10',name:'Roteirista de Saúde Nota 10',description:'Preparação de briefings para conteúdos do profissional.',formats:Object.freeze(['Reels','Carrossel','Videoaula'])}),
])
function findExpert(id        ){return typeof id==='string'?EXPERTS.find(e=>e.id===id)||null:null}
function field(value        ,max       ){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new Error('Revise os campos do briefing.');return value.trim()}
function prepareExpertBrief(input                       ){const expert=findExpert(input.expert);if(!expert||typeof input.format!=='string'||!expert.formats.includes(input.format))throw new Error('Selecione um perfil e formato válidos.');return {expert:expert.id,name:expert.name,format:input.format,objective:field(input.objective,500),audience:field(input.audience,200)}}
function expertBriefText(input                                      ){return ['369 WELLNESS — Briefing do profissional','Documento preparado manualmente; não é uma resposta de IA.','Perfil de apoio: '+input.name,'Formato: '+input.format,'Objetivo: '+input.objective,'Público: '+input.audience,'Conteúdo sujeito à revisão do profissional.'].join('\n')}

return Object.freeze({EXPERTS,findExpert,prepareExpertBrief,expertBriefText});
})();
