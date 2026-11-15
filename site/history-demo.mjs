export const history = [
 {id:'DEMO-04',service:'SERVIÇO-002',revision:1,state:'Agendado',payment:'Pendente',student:'Aluno exemplo B',partner:'Profissional exemplo B',reviews:'Aluno: não · Profissional: não',received:'18/10/2026, 08:30',actor:'Administrador de demonstração'},
 {id:'DEMO-01',service:'SERVIÇO-001',revision:1,state:'Agendado',payment:'Pendente',student:'Aluno exemplo A',partner:'Profissional exemplo A',reviews:'Aluno: não · Profissional: não',received:'18/10/2026, 08:20 · entrega atrasada',actor:'Administrador de demonstração'},
 {id:'DEMO-03',service:'SERVIÇO-001',revision:3,state:'Cancelado',payment:'Estornado (informado)',student:'Aluno exemplo A',partner:'Profissional exemplo A',reviews:'Aluno: sim · Profissional: sim',received:'18/10/2026, 08:15',actor:'Administrador de demonstração'},
 {id:'DEMO-02',service:'SERVIÇO-001',revision:2,state:'Concluído',payment:'Confirmado pelo informante',student:'Aluno exemplo A',partner:'Profissional exemplo A',reviews:'Aluno: sim · Profissional: sim',received:'18/10/2026, 08:10',actor:'Administrador de demonstração'},
]
export function historyPage(month,scenario,page){
 if(!Number.isSafeInteger(page)||page<1)throw Error('Página inválida.')
 if(scenario==='error')throw Error('Exemplo de falha: não foi possível consultar. Tente novamente selecionando outro exemplo.')
 const items=month==='2026-10'&&scenario==='history'?history:[]
 return {rows:items.slice((page-1)*2,page*2),hasNext:items.length>page*2}
}
