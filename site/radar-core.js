'use strict';
const RadarCore=(()=>{
const RADAR_AREAS=Object.freeze(['Educação Física','Nutrição','Fisioterapia','Artes Marciais','Psicologia'])
function radarAreas(value        ){return Array.isArray(value)?[...new Set(value.filter((x)            =>typeof x==='string'&&RADAR_AREAS.includes(x)))].slice(0,5):[]}
function safeReadingURL(value        ){
 if(typeof value!=='string'||value.length>2000)return null
 try{const u=new URL(value);const host=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||u.port||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||/(^|\.)(localhost|local|internal|test|invalid)$/.test(host)||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.test')||host.endsWith('.invalid'))return null;return u.href}catch{return null}
}
function readingDraft(raw                       ){
 if(typeof raw.title!=='string'||!raw.title.trim()||raw.title.trim().length>160||typeof raw.specialty!=='string'||!RADAR_AREAS.includes(raw.specialty)||typeof raw.notes!=='string'||raw.notes.length>2000)throw new Error('Revise título, especialidade e notas.')
 const url=safeReadingURL(raw.url);if(!url)throw new Error('Informe uma URL HTTPS válida, sem credenciais ou endereço local.')
 return {title:raw.title.trim(),specialty:raw.specialty,url,notes:raw.notes.trim()}
}
function radarReferences(raw        ){
 if(!Array.isArray(raw))return []
 return raw.slice(0,20).flatMap(item=>{if(!item||typeof item!=='object')return [];const row=item                          ;const url=safeReadingURL(row.source_url);if(typeof row.title!=='string'||/\[teste\]/i.test(row.title)||!url)return [];return [{title:row.title.slice(0,160),source:typeof row.source_name==='string'?row.source_name.slice(0,120):'',url}]})
}

return Object.freeze({RADAR_AREAS,radarAreas,safeReadingURL,readingDraft,radarReferences});
})();
