import type {CashbackParticipant} from './cashbackDistribution'
function cell(value:string|number){
 const text=String(value)
 let start=0
 while(start<text.length&&(text.charCodeAt(start)<=32||text[start].trim()===''))start++
 const safe=['=','+','-','@'].includes(text[start])?"'"+text:text
 return '"'+safe.replace(/"/g,'""')+'"'
}
export function cashbackPreviewCsv(rows:CashbackParticipant[]){
 const header=['Simulacao','Posicao','Codigo_Participante','Nome','Nivel','Fator','Pontos','Status_Elegibilidade','Cashback_Mes_RS']
 return [header,...rows.map(p=>['Sem credito financeiro',p.position,p.userCode,p.name,p.level,p.factor.toFixed(4),p.points,p.isExcluded?p.exclusionReason||'Excluído':'Elegível',p.cashbackMonth.toFixed(2)])].map(row=>row.map(cell).join(';')).join('\r\n')
}
