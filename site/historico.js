import {historyPage} from './history-demo.mjs'
const $=id=>document.getElementById(id)
let page=1
function render(){
 $('rows').replaceChildren();$('feedback').textContent='';$('pagination').hidden=true
 try{
  const result=historyPage($('month').value,$('scenario').value,page)
  $('feedback').textContent=result.rows.length?`${result.rows.length} revisões fictícias nesta página.`:'Nenhum registro demonstrativo neste mês.'
  if(!result.rows.length){$('feedback').className='empty';return}
  $('feedback').className='note'
  for(const row of result.rows){
   const article=document.createElement('article');article.className='history-row'
   const h=document.createElement('h2');h.textContent=`${row.service} · Revisão ${row.revision} · ${row.state}`;article.append(h)
   const badge=document.createElement('span');badge.className='tag';badge.textContent='Não verificado · Exemplo';article.append(badge)
   const dl=document.createElement('dl')
   for(const [label,value] of [['Aluno',row.student],['Profissional',row.partner],['Pagamento informado',row.payment],['Avaliações informadas',row.reviews]]){const pair=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;pair.append(dt,dd);dl.append(pair)}article.append(dl)
   const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ver rastreabilidade';detail.append(summary)
   for(const text of [`Evento: ${row.id}`,`Recebido em: ${row.received}`,`Registrado por: ${row.actor}`]){const p=document.createElement('p');p.textContent=text;detail.append(p)}article.append(detail);$('rows').append(article)
  }
  $('pagination').hidden=false;$('page-label').textContent=`Página ${page}`;$('previous').disabled=page===1;$('next').disabled=!result.hasNext
 }catch(err){$('feedback').className='notice';$('feedback').textContent=err.message}
}
$('filters').addEventListener('submit',e=>{e.preventDefault();page=1;render()})
for(const id of ['month','scenario'])$(id).addEventListener('change',()=>{page=1;render()})
$('previous').addEventListener('click',()=>{if(page>1){page--;render()}})
$('next').addEventListener('click',()=>{page++;render()})
render()
