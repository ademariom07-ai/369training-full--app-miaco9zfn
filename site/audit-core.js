'use strict';
// Generated from the tested audit display core.
const AuditCore=(()=>{
const secretKey=/(password|passwd|token|secret|authorization|apikey|cookie|credential)/i
function redactAuditDetails(value        )         {
 const seen=new WeakSet        ();let visited=0;
 function walk(input        ,depth=0)         {
  if(++visited>1000)return '[limite de exibição]';if(depth>5)return '[limite de profundidade]';if(input==null)return null;
  if(typeof input==='string')return input.slice(0,2000);if(typeof input==='number')return Number.isFinite(input)?input:null;if(typeof input==='boolean')return input;
  if(typeof input!=='object')return '[valor omitido]';if(seen.has(input))return '[referência repetida]';seen.add(input);
  if(Array.isArray(input))return input.slice(0,50).map(v=>walk(v,depth+1));
  return Object.fromEntries(Object.entries(input).slice(0,50).map(([k,v])=>[k.slice(0,128),secretKey.test(k.replace(/[^a-z0-9]/gi,''))?'[oculto]':walk(v,depth+1)]));
 }
 return walk(value);
}
function auditDetailText(value        )        {const safe=redactAuditDetails(value);return typeof safe==='string'?safe:JSON.stringify(safe)}
function normalizeAuditQuery(value        )        {return String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR')}
function localAuditMatches(row                       ,query       ,actor       ,action       )         {
 return (!actor||row.actor===actor)&&(!action||row.action===action)&&normalizeAuditQuery([row.action,row.target,auditDetailText(row.details),row.actor].join(' ')).includes(normalizeAuditQuery(query.slice(0,100)));
}

return Object.freeze({redactAuditDetails,auditDetailText,normalizeAuditQuery,localAuditMatches});
})();
