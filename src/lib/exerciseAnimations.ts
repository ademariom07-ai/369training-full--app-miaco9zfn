// Biblioteca de animações próprias da 369 (vista lateral, estilo "flat"), desenhadas no app em SVG.
// Cada exercício é uma lista de fases; cada fase termina numa pose. A pose define ângulos dos segmentos
// (graus: 0 = para cima, 90 = para a frente/direita, 180 = para baixo, -90 = para trás) a partir do pé apoiado,
// e opcionalmente um alvo para a mão (resolvido por cinemática inversa de 2 ossos).
// O conteúdo técnico deve ser revisado por um profissional de educação física antes de publicar.

export type Pose={shin:number,thigh:number,torso:number,arm?:number,forearm?:number,hand?:{x:number,y:number},head?:number}
export type Phase={label:string,cues:string[],breath:'inspire'|'expire'|'mantenha',seconds:number,pose:Pose}
export type Prop='barra'|'halteres'|'nenhum'|'banco'
export type ExerciseAnimation={id:string,name:string,subtitle:string,prop:Prop,bench?:{x:number,y:number,w:number,h:number},foot:{x:number,y:number},muscles:string,start:Pose,phases:Phase[],level:'iniciante'|'intermediario'}

// Comprimentos dos segmentos (unidades do desenho 1000×1000).
export const body={shin:205,thigh:215,torso:265,neck:28,head:44,arm:140,forearm:132,foot:70}

export type Joints={ankle:P,knee:P,hip:P,shoulder:P,elbow:P,wrist:P,neck:P,head:P,toe:P}
type P={x:number,y:number}
const rad=(d:number)=>d*Math.PI/180
const step=(p:P,angle:number,len:number):P=>({x:p.x+Math.sin(rad(angle))*len,y:p.y-Math.cos(rad(angle))*len})

// Cinemática inversa de 2 ossos: cotovelo dobrando "para baixo/para trás" (bendSign) até alcançar a mão.
function reach(shoulder:P,target:P,a:number,b:number,bendSign:number){
 const dx=target.x-shoulder.x,dy=target.y-shoulder.y,dist=Math.min(Math.hypot(dx,dy),a+b-0.01)
 const base=Math.atan2(dy,dx),cos=(a*a+dist*dist-b*b)/(2*a*dist),off=Math.acos(Math.max(-1,Math.min(1,cos)))
 const ang=base+bendSign*off,elbow={x:shoulder.x+Math.cos(ang)*a,y:shoulder.y+Math.sin(ang)*a}
 const k=dist/Math.hypot(dx,dy||1e-6),wrist={x:shoulder.x+dx*Math.min(1,k),y:shoulder.y+dy*Math.min(1,k)}
 return{elbow,wrist}
}

export function solve(ex:Pick<ExerciseAnimation,'foot'>,pose:Pose):Joints{
 const ankle=ex.foot,knee=step(ankle,pose.shin,body.shin),hip=step(knee,pose.thigh,body.thigh),shoulder=step(hip,pose.torso,body.torso)
 const neck=step(shoulder,pose.torso+(pose.head??0)*0.3,body.neck),head=step(neck,pose.torso+(pose.head??0),body.head)
 let elbow:P,wrist:P
 if(pose.hand){({elbow,wrist}=reach(shoulder,pose.hand,body.arm,body.forearm,pose.torso>45?1:-1))}
 else{elbow=step(shoulder,pose.arm??180,body.arm);wrist=step(elbow,pose.forearm??180,body.forearm)}
 return{ankle,knee,hip,shoulder,elbow,wrist,neck,head,toe:{x:ankle.x+body.foot,y:ankle.y}}
}

const ease=(t:number)=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2
const mix=(a:number,b:number,t:number)=>a+(b-a)*t
export function blend(a:Pose,b:Pose,t:number):Pose{
 const e=ease(Math.max(0,Math.min(1,t)))
 const out:Pose={shin:mix(a.shin,b.shin,e),thigh:mix(a.thigh,b.thigh,e),torso:mix(a.torso,b.torso,e),head:mix(a.head??0,b.head??0,e)}
 if(a.hand&&b.hand)out.hand={x:mix(a.hand.x,b.hand.x,e),y:mix(a.hand.y,b.hand.y,e)}
 else{out.arm=mix(a.arm??180,b.arm??180,e);out.forearm=mix(a.forearm??180,b.forearm??180,e)}
 return out
}
// Pose e fase em um instante (segundos) do ciclo.
export function frameAt(ex:ExerciseAnimation,time:number){
 const total=ex.phases.reduce((s,p)=>s+p.seconds,0),t=((time%total)+total)%total
 let acc=0,prev=ex.start
 for(let i=0;i<ex.phases.length;i++){const ph=ex.phases[i]
  if(t<acc+ph.seconds)return{pose:blend(prev,ph.pose,(t-acc)/ph.seconds),phase:i,progress:(t-acc)/ph.seconds,total}
  acc+=ph.seconds;prev=ph.pose}
 return{pose:prev,phase:ex.phases.length-1,progress:1,total}
}

const floor=860
export const exerciseAnimations:ExerciseAnimation[]=[
 {id:'remada-curvada-barra',name:'Remada curvada com barra',subtitle:'Costas · vista lateral',prop:'barra',level:'intermediario',foot:{x:430,y:floor},
  muscles:'Latíssimo do dorso, trapézio médio, romboides, deltoide posterior e bíceps',
  start:{shin:8,thigh:-28,torso:62,arm:180,forearm:180,head:20},
  phases:[
   {label:'Posição inicial',cues:['Joelhos levemente flexionados','Tronco inclinado, coluna neutra','Barra pendurada, braços estendidos'],breath:'mantenha',seconds:1,pose:{shin:8,thigh:-28,torso:62,arm:180,forearm:180,head:20}},
   {label:'Puxar',cues:['Leve a barra até a linha do umbigo','Cotovelos junto ao corpo','Aproxime as escápulas'],breath:'expire',seconds:1,pose:{shin:8,thigh:-28,torso:62,arm:285,forearm:182,head:20}},
   {label:'Pausa',cues:['Segure 1 segundo no alto'],breath:'mantenha',seconds:.6,pose:{shin:8,thigh:-28,torso:62,arm:285,forearm:182,head:20}},
   {label:'Descer',cues:['Desça com controle (~2 s)','Estenda os cotovelos','Sem impulso do tronco'],breath:'inspire',seconds:2,pose:{shin:8,thigh:-28,torso:62,arm:180,forearm:180,head:20}},
  ]},
 {id:'agachamento-livre',name:'Agachamento livre',subtitle:'Pernas e glúteos · vista lateral',prop:'nenhum',level:'iniciante',foot:{x:470,y:floor},
  muscles:'Quadríceps, glúteo máximo, posteriores de coxa e core',
  start:{shin:0,thigh:0,torso:0,arm:90,forearm:90},
  phases:[
   {label:'Descer',cues:['Leve o quadril para trás e para baixo','Joelhos na direção dos pés','Peito aberto, coluna neutra'],breath:'inspire',seconds:2,pose:{shin:32,thigh:-78,torso:42,arm:95,forearm:95,head:-10}},
   {label:'Fundo',cues:['Coxas paralelas ao chão (ou até onde for confortável)','Calcanhares no chão'],breath:'mantenha',seconds:.5,pose:{shin:32,thigh:-78,torso:42,arm:95,forearm:95,head:-10}},
   {label:'Subir',cues:['Empurre o chão com o pé inteiro','Estenda quadril e joelhos juntos'],breath:'expire',seconds:1.5,pose:{shin:0,thigh:0,torso:0,arm:90,forearm:90}},
  ]},
 {id:'flexao-de-braco',name:'Flexão de braço',subtitle:'Peito e tríceps · vista lateral',prop:'nenhum',level:'iniciante',foot:{x:190,y:floor},
  muscles:'Peitoral maior, deltoide anterior, tríceps e core',
  start:{shin:68,thigh:68,torso:68,hand:{x:840,y:floor},head:10},
  phases:[
   {label:'Descer',cues:['Corpo alinhado da cabeça aos pés','Cotovelos a ~45° do tronco','Desça até o peito quase tocar o chão'],breath:'inspire',seconds:2,pose:{shin:81,thigh:81,torso:81,hand:{x:840,y:floor},head:10}},
   {label:'Subir',cues:['Empurre o chão','Não deixe o quadril cair'],breath:'expire',seconds:1.2,pose:{shin:68,thigh:68,torso:68,hand:{x:840,y:floor},head:10}},
   {label:'Pausa',cues:['Braços estendidos, abdômen firme'],breath:'mantenha',seconds:.6,pose:{shin:68,thigh:68,torso:68,hand:{x:840,y:floor},head:10}},
  ]},
 {id:'elevacao-de-quadril',name:'Elevação de quadril (ponte)',subtitle:'Glúteos · vista lateral',prop:'nenhum',level:'iniciante',foot:{x:790,y:floor},
  muscles:'Glúteo máximo, posteriores de coxa e core',
  start:{shin:-25,thigh:-135,torso:-90,arm:-90,forearm:-90,head:0},
  phases:[
   {label:'Subir',cues:['Pés firmes, joelhos dobrados','Contraia os glúteos e eleve o quadril','Ombros apoiados no chão'],breath:'expire',seconds:1.2,pose:{shin:-25,thigh:-108.5,torso:-108.5,arm:-95,forearm:-90,head:0}},
   {label:'Segurar',cues:['Linha reta dos joelhos aos ombros','Sem arquear a lombar'],breath:'mantenha',seconds:1,pose:{shin:-25,thigh:-108.5,torso:-108.5,arm:-95,forearm:-90,head:0}},
   {label:'Descer',cues:['Desça devagar até quase tocar o chão'],breath:'inspire',seconds:1.6,pose:{shin:-25,thigh:-135,torso:-90,arm:-90,forearm:-90,head:0}},
  ]},
]

// Nomes que o profissional ou a IA podem usar para cada animação (sem acento, minúsculas).
const aliases:Record<string,string[]>={
 'remada-curvada-barra':['remada curvada','remada curvada com barra','remada curvada barra','bent over row'],
 'agachamento-livre':['agachamento','agachamento livre','agachamento com peso corporal','agachamento sem peso','squat'],
 'flexao-de-braco':['flexao','flexao de braco','flexao de bracos','flexao no solo','push up','push-up'],
 'elevacao-de-quadril':['elevacao de quadril','ponte','ponte de gluteo','ponte de gluteos','elevacao pelvica','glute bridge'],
}
export const normalizeName=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 -]/g,' ').replace(/\s+/g,' ').trim()
export function findAnimation(name:string):ExerciseAnimation|null{
 const key=normalizeName(name)
 for(const ex of exerciseAnimations){if(normalizeName(ex.name)===key||(aliases[ex.id]||[]).includes(key))return ex}
 return null
}
