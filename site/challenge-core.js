'use strict';
const ChallengeCore=(()=>{
function challengeDuration(value         ) { return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 365 ? value : null }
function dateValid(value         )                  { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value }
function challengeDays(value         , duration        , today        ) { return Array.isArray(value) ? [...new Set(value.slice(0,1000).filter(x=>dateValid(x)&&x<=today))].sort().slice(0,duration)             : [] }
function challengeProjection(raw                         ) {
 const duration=challengeDuration(raw.dias_total)
 if(typeof raw.id!=='string'||typeof raw.title!=='string'||!duration) return null
 return { id:raw.id.slice(0,100), title:raw.title.slice(0,160), description:typeof raw.description==='string'?raw.description.slice(0,2000):'', rules:typeof raw.regras==='string'?raw.regras.slice(0,2000):'', duration }
}
function parseDemoChallenge(title         , description         , duration         ) {
 if(typeof title!=='string'||!title.trim()||title.trim().length>160||typeof description!=='string'||description.trim().length>2000||typeof duration!=='string'||!/^\d+$/.test(duration))throw new Error('Revise título, descrição e duração.')
 const days=challengeDuration(Number(duration));if(!days)throw new Error('A duração deve ser de 1 a 365 dias.')
 return {title:title.trim(),description:description.trim(),duration:days}
}

return Object.freeze({challengeDuration,challengeDays,challengeProjection,parseDemoChallenge});
})();
