const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function setup(){
 const html=fs.readFileSync('docs/previews/369-wellness-cashback-linear.html','utf8');
 const node=()=>({value:'',textContent:'',children:[],attrs:{},setAttribute(k,v){this.attrs[k]=v},replaceChildren(){this.children=[]},append(x){this.children.push(x)}});
 const nodes=new Map();for(const id of ['pool','count','goals','rows','summary','page','prev','next','error','form','a','b','c'])nodes.set(id,node());
 nodes.get('pool').value='10000,00';nodes.get('count').value='20';nodes.get('goals').value='0';
 vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1],{document:{getElementById:id=>nodes.get(id),createElement:node}});
 const get=id=>nodes.get(id),row=i=>get('rows').children[i].children;
 const select=(i,col,value)=>{const field=row(i)[col].children[0];field.value=value;field.onchange()};
 return {get,row,select};
}
test('individual goals change only the selected payout, not gross ranking or other participant',()=>{const {get,row,select}=setup();get('c').onclick();const gross=row(0)[4].textContent,other=row(1)[7].textContent,net=row(0)[7].textContent;select(0,3,'3');assert.equal(row(0)[4].textContent,gross);assert.equal(row(0)[7].textContent,gross);assert.notEqual(net,gross);assert.equal(row(1)[7].textContent,other);assert.equal(row(0)[0].textContent,'1º')});
test('free keeps position and zero weight while every ineligible participant leaves entire pool unallocated',()=>{const {get,row,select}=setup();get('c').onclick();select(0,1,'free');assert.equal(row(0)[0].textContent,'1º');assert.equal(row(0)[2].textContent,0);assert.equal(row(0)[3].children[0].disabled,true);for(let i=1;i<10;i++)select(i,1,'free');assert.match(get('summary').textContent,/Não distribuído: R\$\s200\.000,00/);assert.equal(row(9)[0].textContent,'10º')});
test('row changes preserve pagination and examples reset individual overrides',()=>{const {get,row,select}=setup();get('b').onclick();get('next').onclick();select(0,1,'free');assert.equal(get('page').textContent,'2 / 25');assert.equal(row(0)[0].textContent,'21º');get('prev').onclick();get('next').onclick();assert.equal(row(0)[1].children[0].value,'free');get('b').onclick();get('next').onclick();assert.equal(row(0)[1].children[0].value,'paid')});
test('invalid counts remove stale money and count changes clear overrides',()=>{const {get,row,select}=setup();select(0,1,'free');get('count').value='0';get('form').onsubmit({preventDefault(){}});assert.ok(get('error').textContent);assert.equal(get('rows').children.length,0);assert.equal(get('summary').textContent,'');get('count').value='10';get('form').onsubmit({preventDefault(){}});assert.equal(row(0)[1].children[0].value,'paid')});
