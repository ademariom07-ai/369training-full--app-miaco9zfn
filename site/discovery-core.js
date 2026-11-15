(function(root){
 'use strict';
 const areas=['Educação Física','Nutrição','Fisioterapia','Psicologia','Artes Marciais'];
 function validPoint(p){return !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180}
 function distance(a,b){if(!validPoint(a)||!validPoint(b))return null;const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))))}
 function select(rows,{area='',origin=null,radius=50}={}){if(!Array.isArray(rows)||!Number.isFinite(radius)||radius<=0)throw Error('Filtro inválido');const positioned=validPoint(origin);return rows.filter(p=>p.approved===true&&p.authorized===true&&p.visible===true&&areas.includes(p.area)&&(!area||p.area===area)).map(p=>({...p,distanceKm:positioned?distance(origin,p.location):null})).filter(p=>!positioned||(p.distanceKm!==null&&p.distanceKm<=radius)).sort((a,b)=>positioned?a.distanceKm-b.distanceKm||String(a.id).localeCompare(String(b.id)):String(a.id).localeCompare(String(b.id)))}
 const api={areas,validPoint,distance,select};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DiscoveryCore=api;
})(typeof window==='undefined'?globalThis:window);
