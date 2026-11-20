import {describe,it,expect} from 'vitest'
import {normalizeStructure,recentDates,sessionEntriesFrom,summarizeSessions,todayInfo} from './routines'
import {generateRoutine} from './aiRoutine'
import {roleMenu} from '@/components/RoleHome'

describe('fase 3: treino e dieta',()=>{
 it('treino: link do YouTube vira id, séries validadas, linhas vazias removidas',()=>{
  const s=normalizeStructure('treino',{days:[{key:'seg',name:' Treino A ',items:[{name:'Agachamento',sets:4,reps:'10',rest:'60s',load:'',video:'https://youtu.be/dQw4w9WgXcQ?si=x',notes:''},{name:'  ',sets:3,reps:'',rest:'',load:'',video:null,notes:''}]}]})
  expect(s).toEqual({days:[{key:'seg',name:'Treino A',items:[{name:'Agachamento',sets:4,reps:'10',rest:'60s',load:'',video:'dQw4w9WgXcQ',notes:''}]}]})
 })
 it('treino: recusa vídeo que não é YouTube, dia repetido e séries fora do limite',()=>{
  const ex={name:'Remada',sets:3,reps:'12',rest:'',load:'',video:null,notes:''}
  expect(()=>normalizeStructure('treino',{days:[{key:'seg',name:'A',items:[{...ex,video:'https://vimeo.com/1'}]}]})).toThrow('YouTube')
  expect(()=>normalizeStructure('treino',{days:[{key:'seg',name:'A',items:[ex]},{key:'seg',name:'B',items:[ex]}]})).toThrow('uma vez')
  expect(()=>normalizeStructure('treino',{days:[{key:'seg',name:'A',items:[{...ex,sets:20}]}]})).toThrow('Séries')
 })
 it('dieta: horário inválido vira vazio e refeição sem alimento é recusada',()=>{
  const s=normalizeStructure('dieta',{meals:[{name:'Café',time:'25:00',items:[{food:'Ovos',qty:'2',notes:'',subs:''}]}]})
  expect('meals' in s&&s.meals[0].time).toBeNull()
  expect(()=>normalizeStructure('dieta',{meals:[{name:'Almoço',time:null,items:[{food:' ',qty:'',notes:'',subs:''}]}]})).toThrow('alimentos')
 })
 it('dia da semana de hoje é calculado no fuso de São Paulo',()=>{
  expect(todayInfo(new Date('2026-11-20T02:00:00Z'))).toEqual({iso:'2026-11-19',day:'qui'})
 })
 it('IA: dias e tempo validados antes de chamar o servidor',async()=>{
  await expect(generateRoutine('treino','11111111-1111-4111-8111-111111111111',{goal:'x',level:'x',days:[],minutes:45,place:'',equipment:'',limitations:''},{} as never)).rejects.toThrow('dias')
 })
 it('menus: aluno e parceiro têm IA; admin e parceiro pendente não',()=>{
  expect(roleMenu({role:'aluno',approved:false}).map(i=>i.id)).toEqual(expect.arrayContaining(['treino','ia']))
  expect(roleMenu({role:'profissional',approved:true}).map(i=>i.id)).toEqual(expect.arrayContaining(['treinos','ia']))
  expect(roleMenu({role:'admin',approved:false}).map(i=>i.id)).not.toContain('ia')
  expect(roleMenu({role:'profissional',approved:false}).map(i=>i.id)).not.toContain('ia')
 })
})
import {findAnimation,frameAt,exerciseAnimations} from '@/lib/exerciseAnimations'
describe('biblioteca de animações 369',()=>{
 it('encontra a animação por nome com ou sem acento e por apelido',()=>{
  expect(findAnimation('Remada curvada com barra')?.id).toBe('remada-curvada-barra')
  expect(findAnimation('FLEXÃO DE BRAÇOS')?.id).toBe('flexao-de-braco')
  expect(findAnimation('Ponte de glúteo')?.id).toBe('elevacao-de-quadril')
  expect(findAnimation('Supino inclinado')?.id).toBe('supino-inclinado-halteres');expect(findAnimation('Agachamento hack na máquina')).toBeNull();expect(exerciseAnimations).toHaveLength(30);expect(new Set(exerciseAnimations.map(e=>e.id)).size).toBe(30)
 })
 it('ciclo percorre todas as fases e volta ao início',()=>{
  for(const ex of exerciseAnimations){const total=ex.phases.reduce((s,p)=>s+p.seconds,0)
   expect(frameAt(ex,0).phase).toBe(0);expect(frameAt(ex,total-0.01).phase).toBe(ex.phases.length-1);expect(frameAt(ex,total+0.01).phase).toBe(0)}
 })
})
import {readFileSync} from 'node:fs'
describe('IA e biblioteca de animações',()=>{
 it('a lista de exercícios da função de IA é a mesma da biblioteca do app',()=>{
  const fn=readFileSync(new URL('../../../supabase/functions/routine-ai/index.ts',import.meta.url),'utf8')
  const list=JSON.parse(/const LIBRARY = (\[.*\])/.exec(fn)![1]) as string[]
  expect([...list].sort()).toEqual(exerciseAnimations.map(e=>e.name).sort())
  for(const name of list)expect(findAnimation(name)).not.toBeNull()
 })
})
describe('reconhecimento tolerante de nomes',()=>{
 it('aceita variações próximas e recusa exercícios diferentes',()=>{
  expect(findAnimation('Agachamento goblet')?.id).toBe('agachamento-goblet')
  expect(findAnimation('Supino reto halteres')?.id).toBe('supino-reto-halteres')
  expect(findAnimation('Rosca direta')?.id).toBe('rosca-direta-halteres')
  expect(findAnimation('Leg press')?.id).toBe('leg-press-45')
  expect(findAnimation('Elevação lateral com halteres')).toBeNull()
  expect(findAnimation('Corrida na esteira')).toBeNull()
  expect(findAnimation('Agachamento sumô')).toBeNull()
 })
})
describe('registro do treino feito',()=>{
 const base={plan_id:'p',plan_title:'Semana',day_key:'seg' as const,day_name:'A',effort:7,note:null,entries:[],updated_at:''}
 it('lista hoje e os 7 dias anteriores no fuso de São Paulo',()=>{
  const d=recentDates(new Date('2026-11-20T02:00:00Z'))
  expect(d).toHaveLength(8);expect(d[0]).toBe('2026-11-19');expect(d[7]).toBe('2026-11-12')
 })
 it('resume por aluno, com quem relatou dor primeiro',()=>{
  const now=new Date('2026-11-20T15:00:00Z')
  const rows=[{...base,session_id:'1',student_id:'a',student_name:'Ana',done_on:'2026-11-20',pain:0 as const},{...base,session_id:'2',student_id:'a',student_name:'Ana',done_on:'2026-11-18',pain:0 as const},
   {...base,session_id:'3',student_id:'b',student_name:'Célia',done_on:'2026-11-17',pain:1 as const},{...base,session_id:'4',student_id:'b',student_name:'Célia',done_on:'2026-10-01',pain:2 as const}]
  const s=summarizeSessions(rows,now)
  expect(s.map(x=>x.student_name)).toEqual(['Célia','Ana'])
  expect(s[0]).toMatchObject({week:1,pain:true});expect(s[1]).toMatchObject({week:2,pain:false});expect(s[1].last.done_on).toBe('2026-11-20')
 })
 it('parte do treino do dia, tudo marcado como feito',()=>{
  expect(sessionEntriesFrom({key:'seg',name:'A',items:[{name:'Remada',sets:3,reps:'12',rest:'60s',load:'10 kg',video:null,notes:''}]})).toEqual([{name:'Remada',done:true,sets:3,reps:'12',load:'10 kg'}])
 })
})
