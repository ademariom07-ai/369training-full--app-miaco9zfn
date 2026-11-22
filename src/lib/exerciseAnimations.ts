// Biblioteca de animações próprias da 369 (vista lateral, estilo "flat"), desenhadas no app em SVG.
// Cada exercício é uma lista de fases; cada fase termina numa pose. A pose define ângulos dos segmentos
// (graus: 0 = para cima, 90 = para a frente/direita, 180 = para baixo, -90 = para trás) a partir do pé apoiado,
// e opcionalmente um alvo para a mão (resolvido por cinemática inversa de 2 ossos).
// O conteúdo técnico deve ser revisado por um profissional de educação física antes de publicar.

export type Pose={shin:number,thigh:number,torso:number,arm?:number,forearm?:number,hand?:{x:number,y:number},handRel?:{x:number,y:number},handHip?:{x:number,y:number},head?:number,bend?:1|-1,back?:{thigh:number,shin:number},heel?:number}
export type Phase={label:string,cues:string[],breath:'inspire'|'expire'|'mantenha'|'livre',seconds:number,pose:Pose}
export type Prop='barra'|'halteres'|'nenhum'|'puxador'|'plataforma'
export type Shape={rect:[number,number,number,number],rotate?:number}|{line:[number,number,number,number],width?:number}
export type ExerciseAnimation={id:string,name:string,subtitle:string,prop:Prop,root?:'pe'|'quadril',foot:{x:number,y:number},hip?:{x:number,y:number},
 scenery?:Shape[],cable?:{x:number,y:number},zoom?:number,muscles:string,start:Pose,phases:Phase[],level:'iniciante'|'intermediario'}

// Comprimentos dos segmentos (unidades do desenho 1000×1000).
export const body={shin:205,thigh:215,torso:265,neck:28,head:44,arm:140,forearm:132,foot:70}

export type Joints={ankle:P,knee:P,hip:P,shoulder:P,elbow:P,wrist:P,neck:P,head:P,toe:P,back?:{knee:P,ankle:P,toe:P}}
type P={x:number,y:number}
const rad=(d:number)=>d*Math.PI/180
const step=(p:P,angle:number,len:number):P=>({x:p.x+Math.sin(rad(angle))*len,y:p.y-Math.cos(rad(angle))*len})

// Cinemática inversa de 2 ossos: cotovelo dobrando para um dos lados (bendSign) até alcançar a mão.
function reach(shoulder:P,target:P,a:number,b:number,bendSign:number){
 const dx=target.x-shoulder.x,dy=target.y-shoulder.y,dist=Math.min(Math.hypot(dx,dy),a+b-0.01)
 const base=Math.atan2(dy,dx),cos=(a*a+dist*dist-b*b)/(2*a*dist),off=Math.acos(Math.max(-1,Math.min(1,cos)))
 const ang=base+bendSign*off,elbow={x:shoulder.x+Math.cos(ang)*a,y:shoulder.y+Math.sin(ang)*a}
 const k=dist/Math.hypot(dx,dy||1e-6),wrist={x:shoulder.x+dx*Math.min(1,k),y:shoulder.y+dy*Math.min(1,k)}
 return{elbow,wrist}
}

// Posição das articulações. Raiz no pé (padrão) ou no quadril (deitado, sentado em máquina).
export function solve(ex:Pick<ExerciseAnimation,'foot'|'root'|'hip'>,pose:Pose):Joints{
 let ankle:P,knee:P,hip:P
 if(ex.root==='quadril'&&ex.hip){hip=ex.hip;knee=step(hip,pose.thigh+180,body.thigh);ankle=step(knee,pose.shin+180,body.shin)}
 else{ankle={x:ex.foot.x,y:ex.foot.y-(pose.heel??0)};knee=step(ankle,pose.shin,body.shin);hip=step(knee,pose.thigh,body.thigh)}
 const shoulder=step(hip,pose.torso,body.torso)
 const neck=step(shoulder,pose.torso+(pose.head??0)*0.3,body.neck),head=step(neck,pose.torso+(pose.head??0),body.head)
 let elbow:P,wrist:P
 const target=pose.hand??(pose.handRel?{x:shoulder.x+pose.handRel.x,y:shoulder.y+pose.handRel.y}:pose.handHip?{x:hip.x+pose.handHip.x,y:hip.y+pose.handHip.y}:null)
 if(target){({elbow,wrist}=reach(shoulder,target,body.arm,body.forearm,pose.bend??(pose.torso>45?1:-1)))}
 else{elbow=step(shoulder,pose.arm??180,body.arm);wrist=step(elbow,pose.forearm??180,body.forearm)}
 const toe=pose.heel?{x:ex.foot.x+body.foot,y:ex.foot.y}:{x:ankle.x+body.foot,y:ankle.y}
 const out:Joints={ankle,knee,hip,shoulder,elbow,wrist,neck,head,toe}
 if(pose.back){const k2=step(hip,pose.back.thigh,body.thigh),a2=step(k2,pose.back.shin,body.shin);out.back={knee:k2,ankle:a2,toe:{x:a2.x+body.foot*.8,y:a2.y+8}}}
 return out
}

const ease=(t:number)=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2
const mix=(a:number,b:number,t:number)=>a+(b-a)*t
// Ângulos pelo caminho mais curto (ex.: de 170° para -170° passa por 180°).
const mixAngle=(a:number,b:number,t:number)=>a+((((b-a)%360)+540)%360-180)*t
const mixP=(a:{x:number,y:number}|undefined,b:{x:number,y:number}|undefined,t:number)=>a&&b?{x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)}:b
export function blend(a:Pose,b:Pose,t:number):Pose{
 const e=ease(Math.max(0,Math.min(1,t)))
 const out:Pose={shin:mixAngle(a.shin,b.shin,e),thigh:mixAngle(a.thigh,b.thigh,e),torso:mixAngle(a.torso,b.torso,e),head:mix(a.head??0,b.head??0,e),bend:b.bend,heel:mix(a.heel??0,b.heel??0,e)}
 if(b.hand)out.hand=mixP(a.hand,b.hand,e);else if(b.handRel)out.handRel=mixP(a.handRel,b.handRel,e);else if(b.handHip)out.handHip=mixP(a.handHip,b.handHip,e)
 else{out.arm=mixAngle(a.arm??180,b.arm??180,e);out.forearm=mixAngle(a.forearm??180,b.forearm??180,e)}
 if(a.back&&b.back)out.back={thigh:mixAngle(a.back.thigh,b.back.thigh,e),shin:mixAngle(a.back.shin,b.back.shin,e)}
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
 // ---------- Pernas ----------
 {id:'agachamento-barra',name:'Agachamento com barra',subtitle:'Pernas e glúteos · vista lateral',prop:'barra',level:'intermediario',foot:{x:470,y:floor},
  muscles:'Quadríceps, glúteo máximo, posteriores de coxa, eretores da coluna e core',
  start:{shin:2,thigh:-2,torso:4,handRel:{x:-18,y:-6},bend:-1},
  phases:[
   {label:'Descer',cues:['Barra apoiada no trapézio','Quadril para trás e para baixo','Joelhos na direção dos pés'],breath:'inspire',seconds:2,pose:{shin:34,thigh:-80,torso:44,handRel:{x:-18,y:-6},bend:-1,head:-15}},
   {label:'Fundo',cues:['Coxas paralelas ao chão','Coluna neutra, peito aberto'],breath:'mantenha',seconds:.5,pose:{shin:34,thigh:-80,torso:44,handRel:{x:-18,y:-6},bend:-1,head:-15}},
   {label:'Subir',cues:['Empurre o chão com o pé inteiro','Quadril e ombros sobem juntos'],breath:'expire',seconds:1.5,pose:{shin:2,thigh:-2,torso:4,handRel:{x:-18,y:-6},bend:-1}},
  ]},
 {id:'agachamento-goblet',name:'Agachamento goblet com halter',subtitle:'Pernas e glúteos · vista lateral',prop:'halteres',level:'iniciante',foot:{x:470,y:floor},
  muscles:'Quadríceps, glúteo máximo, adutores e core',
  start:{shin:2,thigh:-2,torso:2,handRel:{x:60,y:40},bend:1},
  phases:[
   {label:'Descer',cues:['Halter junto ao peito','Desça entre as pernas','Tronco o mais ereto possível'],breath:'inspire',seconds:2,pose:{shin:36,thigh:-84,torso:28,handRel:{x:60,y:40},bend:1,head:-10}},
   {label:'Fundo',cues:['Cotovelos por dentro dos joelhos','Calcanhares no chão'],breath:'mantenha',seconds:.5,pose:{shin:36,thigh:-84,torso:28,handRel:{x:60,y:40},bend:1,head:-10}},
   {label:'Subir',cues:['Empurre o chão e estenda o quadril'],breath:'expire',seconds:1.5,pose:{shin:2,thigh:-2,torso:2,handRel:{x:60,y:40},bend:1}},
  ]},
 {id:'afundo',name:'Afundo (avanço)',subtitle:'Pernas e glúteos · vista lateral',prop:'nenhum',level:'iniciante',foot:{x:600,y:floor},
  muscles:'Quadríceps, glúteo máximo, posteriores de coxa e panturrilha',
  start:{shin:-6,thigh:-14,torso:0,handHip:{x:30,y:-20},bend:1,back:{thigh:-150,shin:-178}},
  phases:[
   {label:'Descer',cues:['Passo longo, tronco reto','Desça o joelho de trás em direção ao chão','Joelho da frente alinhado ao pé'],breath:'inspire',seconds:2,pose:{shin:8,thigh:-82,torso:0,handHip:{x:30,y:-20},bend:1,back:{thigh:-178,shin:-100}}},
   {label:'Fundo',cues:['Os dois joelhos perto de 90°'],breath:'mantenha',seconds:.5,pose:{shin:8,thigh:-82,torso:0,handHip:{x:30,y:-20},bend:1,back:{thigh:-178,shin:-100}}},
   {label:'Subir',cues:['Empurre com o pé da frente','Volte à posição inicial'],breath:'expire',seconds:1.5,pose:{shin:-6,thigh:-14,torso:0,handHip:{x:30,y:-20},bend:1,back:{thigh:-150,shin:-178}}},
  ]},
 {id:'levantamento-terra',name:'Levantamento terra',subtitle:'Posterior e costas · vista lateral',prop:'barra',level:'intermediario',foot:{x:470,y:floor},
  muscles:'Glúteo máximo, posteriores de coxa, eretores da coluna, quadríceps e trapézio',
  start:{shin:22,thigh:-58,torso:62,arm:182,forearm:182,head:15},
  phases:[
   {label:'Subir',cues:['Barra rente às pernas','Empurre o chão e estenda quadril e joelhos','Coluna neutra o tempo todo'],breath:'expire',seconds:1.6,pose:{shin:0,thigh:0,torso:0,arm:180,forearm:180}},
   {label:'Topo',cues:['Quadril estendido, glúteos contraídos','Sem jogar o tronco para trás'],breath:'mantenha',seconds:.5,pose:{shin:0,thigh:0,torso:0,arm:180,forearm:180}},
   {label:'Descer',cues:['Leve o quadril para trás primeiro','Desça a barra rente às pernas até o chão'],breath:'inspire',seconds:2,pose:{shin:22,thigh:-58,torso:62,arm:182,forearm:182,head:15}},
  ]},
 {id:'stiff-barra',name:'Stiff com barra',subtitle:'Posterior de coxa · vista lateral',prop:'barra',level:'intermediario',foot:{x:470,y:floor},
  muscles:'Posteriores de coxa, glúteo máximo e eretores da coluna',
  start:{shin:4,thigh:-6,torso:0,arm:180,forearm:180},
  phases:[
   {label:'Descer',cues:['Joelhos levemente flexionados','Quadril vai para trás','Barra desliza rente às coxas'],breath:'inspire',seconds:2,pose:{shin:6,thigh:-26,torso:74,arm:182,forearm:182,head:15}},
   {label:'Alongar',cues:['Sinta a parte de trás da coxa alongar','Coluna neutra'],breath:'mantenha',seconds:.5,pose:{shin:6,thigh:-26,torso:74,arm:182,forearm:182,head:15}},
   {label:'Subir',cues:['Contraia os glúteos e volte o quadril à frente'],breath:'expire',seconds:1.5,pose:{shin:4,thigh:-6,torso:0,arm:180,forearm:180}},
  ]},
 {id:'panturrilha-em-pe',name:'Panturrilha em pé',subtitle:'Panturrilhas · vista lateral',prop:'nenhum',level:'iniciante',foot:{x:470,y:floor},
  muscles:'Gastrocnêmio e sóleo',
  start:{shin:0,thigh:0,torso:0,arm:178,forearm:178,heel:0},
  phases:[
   {label:'Subir',cues:['Suba na ponta dos pés','Joelhos estendidos, sem travar'],breath:'expire',seconds:1,pose:{shin:0,thigh:0,torso:0,arm:178,forearm:178,heel:48}},
   {label:'Pausa',cues:['Segure 1 segundo no alto'],breath:'mantenha',seconds:1,pose:{shin:0,thigh:0,torso:0,arm:178,forearm:178,heel:48}},
   {label:'Descer',cues:['Desça devagar até o calcanhar quase tocar o chão'],breath:'inspire',seconds:1.5,pose:{shin:0,thigh:0,torso:0,arm:178,forearm:178,heel:0}},
  ]},
 {id:'cadeira-extensora',name:'Cadeira extensora',subtitle:'Quadríceps · vista lateral',prop:'nenhum',level:'iniciante',root:'quadril',foot:{x:0,y:0},hip:{x:420,y:600},
  scenery:[{rect:[300,635,250,40]},{rect:[290,330,40,320],rotate:-8},{line:[420,675,420,860],width:24}],
  muscles:'Quadríceps (reto femoral e vastos)',
  start:{thigh:-90,shin:0,torso:-6,arm:178,forearm:170},
  phases:[
   {label:'Estender',cues:['Costas apoiadas no encosto','Estenda os joelhos sem tirar o quadril do banco'],breath:'expire',seconds:1.2,pose:{thigh:-90,shin:-88,torso:-6,arm:178,forearm:170}},
   {label:'Pausa',cues:['Contraia a frente da coxa por 1 segundo'],breath:'mantenha',seconds:.8,pose:{thigh:-90,shin:-88,torso:-6,arm:178,forearm:170}},
   {label:'Descer',cues:['Volte devagar, controlando o peso'],breath:'inspire',seconds:2,pose:{thigh:-90,shin:0,torso:-6,arm:178,forearm:170}},
  ]},
 {id:'mesa-flexora',name:'Mesa flexora',subtitle:'Posterior de coxa · vista lateral',prop:'nenhum',level:'iniciante',root:'quadril',foot:{x:0,y:0},hip:{x:520,y:660},
  scenery:[{rect:[200,695,620,40]},{line:[300,735,300,860],width:24},{line:[720,735,720,860],width:24}],
  muscles:'Posteriores de coxa (bíceps femoral, semitendíneo, semimembranáceo) e panturrilha',
  start:{thigh:90,shin:90,torso:90,arm:160,forearm:200,head:0},
  phases:[
   {label:'Flexionar',cues:['Quadril apoiado no banco','Traga os calcanhares em direção aos glúteos'],breath:'expire',seconds:1.2,pose:{thigh:90,shin:-175,torso:90,arm:160,forearm:200}},
   {label:'Pausa',cues:['Contraia a parte de trás da coxa'],breath:'mantenha',seconds:.8,pose:{thigh:90,shin:-175,torso:90,arm:160,forearm:200}},
   {label:'Estender',cues:['Volte devagar até quase estender os joelhos'],breath:'inspire',seconds:2,pose:{thigh:90,shin:90,torso:90,arm:160,forearm:200}},
  ]},
 {id:'leg-press-45',name:'Leg press 45°',subtitle:'Pernas e glúteos · vista lateral',prop:'plataforma',level:'iniciante',root:'quadril',foot:{x:0,y:0},hip:{x:430,y:700},
  scenery:[{rect:[190,700,300,40],rotate:-40},{rect:[370,730,120,40]}],
  muscles:'Quadríceps, glúteo máximo e posteriores de coxa',
  start:{thigh:-128,shin:-122,torso:-50,arm:150,forearm:160},
  phases:[
   {label:'Descer',cues:['Costas e quadril colados no encosto','Dobre os joelhos em direção ao peito'],breath:'inspire',seconds:2,pose:{thigh:-160,shin:-70,torso:-50,arm:150,forearm:160}},
   {label:'Empurrar',cues:['Empurre com o pé inteiro','Não trave os joelhos no final'],breath:'expire',seconds:1.5,pose:{thigh:-128,shin:-122,torso:-50,arm:150,forearm:160}},
   {label:'Pausa',cues:['Joelhos quase estendidos, sem travar'],breath:'mantenha',seconds:.5,pose:{thigh:-128,shin:-122,torso:-50,arm:150,forearm:160}},
  ]},
 {id:'elevacao-pelvica-barra',name:'Elevação pélvica com barra',subtitle:'Glúteos · vista lateral',prop:'barra',level:'intermediario',foot:{x:720,y:floor},
  // Banco atrás: a parte de cima das costas fica apoiada na borda; o quadril sobe até alinhar com o tronco.
  scenery:[{rect:[90,690,190,170]}],
  muscles:'Glúteo máximo, posteriores de coxa e core',
  start:{shin:-28,thigh:-128,torso:-55,handHip:{x:0,y:-55},bend:1,head:20},
  phases:[
   {label:'Subir',cues:['Parte de cima das costas no banco','Empurre o chão com os calcanhares','Eleve o quadril até alinhar com o tronco'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:-90,torso:-89,handHip:{x:0,y:-55},bend:1,head:35}},
   {label:'Segurar',cues:['Contraia os glúteos no alto','Queixo levemente para baixo','Joelhos a 90°'],breath:'mantenha',seconds:1,pose:{shin:0,thigh:-90,torso:-89,handHip:{x:0,y:-55},bend:1,head:35}},
   {label:'Descer',cues:['Desça o quadril com controle','Costas continuam no banco'],breath:'inspire',seconds:1.6,pose:{shin:-28,thigh:-128,torso:-55,handHip:{x:0,y:-55},bend:1,head:20}},
  ]},
 // ---------- Peito ----------
 {id:'supino-reto-barra',name:'Supino reto com barra',subtitle:'Peito · vista lateral',prop:'barra',level:'intermediario',foot:{x:720,y:floor},
  scenery:[{rect:[180,700,360,36]},{line:[260,736,260,860],width:22},{line:[480,736,480,860],width:22}],
  muscles:'Peitoral maior, deltoide anterior e tríceps',
  start:{shin:0,thigh:-90,torso:-90,hand:{x:262,y:400},bend:1,head:0},
  phases:[
   {label:'Descer',cues:['Escápulas apertadas no banco','Desça a barra até o meio do peito','Cotovelos a ~45° do tronco'],breath:'inspire',seconds:2,pose:{shin:0,thigh:-90,torso:-90,hand:{x:278,y:590},bend:1}},
   {label:'Empurrar',cues:['Empurre a barra para cima','Pés firmes no chão'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:-90,torso:-90,hand:{x:262,y:400},bend:1}},
   {label:'Pausa',cues:['Braços estendidos, sem travar os cotovelos'],breath:'mantenha',seconds:.6,pose:{shin:0,thigh:-90,torso:-90,hand:{x:262,y:400},bend:1}},
  ]},
 {id:'supino-reto-halteres',name:'Supino reto com halteres',subtitle:'Peito · vista lateral',prop:'halteres',level:'iniciante',foot:{x:720,y:floor},
  scenery:[{rect:[180,700,360,36]},{line:[260,736,260,860],width:22},{line:[480,736,480,860],width:22}],
  muscles:'Peitoral maior, deltoide anterior e tríceps',
  start:{shin:0,thigh:-90,torso:-90,hand:{x:262,y:400},bend:1},
  phases:[
   {label:'Descer',cues:['Halteres na linha do peito','Desça até os cotovelos ficarem um pouco abaixo do banco'],breath:'inspire',seconds:2,pose:{shin:0,thigh:-90,torso:-90,hand:{x:282,y:600},bend:1}},
   {label:'Empurrar',cues:['Empurre os halteres para cima','Aproxime-os no alto, sem bater'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:-90,torso:-90,hand:{x:262,y:400},bend:1}},
   {label:'Pausa',cues:['Braços estendidos, ombros no banco'],breath:'mantenha',seconds:.6,pose:{shin:0,thigh:-90,torso:-90,hand:{x:262,y:400},bend:1}},
  ]},
 {id:'supino-inclinado-halteres',name:'Supino inclinado com halteres',subtitle:'Peito superior · vista lateral',prop:'halteres',level:'intermediario',foot:{x:720,y:floor},
  scenery:[{rect:[440,700,140,36]},{rect:[250,520,260,36],rotate:-38},{line:[500,736,500,860],width:22}],
  muscles:'Peitoral maior (porção superior), deltoide anterior e tríceps',
  start:{shin:0,thigh:-90,torso:-52,handRel:{x:20,y:-262},bend:1},
  phases:[
   {label:'Descer',cues:['Banco a 30–45°','Desça os halteres até a linha do peito'],breath:'inspire',seconds:2,pose:{shin:0,thigh:-90,torso:-52,handRel:{x:60,y:-40},bend:1}},
   {label:'Empurrar',cues:['Empurre para cima e um pouco para dentro'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:-90,torso:-52,handRel:{x:20,y:-262},bend:1}},
   {label:'Pausa',cues:['Braços estendidos, sem travar'],breath:'mantenha',seconds:.6,pose:{shin:0,thigh:-90,torso:-52,handRel:{x:20,y:-262},bend:1}},
  ]},
 {id:'flexao-inclinada',name:'Flexão inclinada (mãos no banco)',subtitle:'Peito e tríceps · vista lateral',prop:'nenhum',level:'iniciante',foot:{x:180,y:floor},
  scenery:[{rect:[700,640,200,40]},{line:[740,680,740,860],width:22},{line:[860,680,860,860],width:22}],
  muscles:'Peitoral maior, deltoide anterior, tríceps e core',
  start:{shin:56,thigh:56,torso:56,hand:{x:790,y:632},bend:1,head:10},
  phases:[
   {label:'Descer',cues:['Corpo reto, mãos no banco','Desça o peito em direção ao banco'],breath:'inspire',seconds:2,pose:{shin:66,thigh:66,torso:66,hand:{x:790,y:632},bend:1,head:10}},
   {label:'Subir',cues:['Empurre o banco, abdômen firme'],breath:'expire',seconds:1.2,pose:{shin:56,thigh:56,torso:56,hand:{x:790,y:632},bend:1,head:10}},
   {label:'Pausa',cues:['Braços estendidos'],breath:'mantenha',seconds:.6,pose:{shin:56,thigh:56,torso:56,hand:{x:790,y:632},bend:1,head:10}},
  ]},
 // ---------- Costas ----------
 {id:'remada-curvada-halteres',name:'Remada curvada com halteres',subtitle:'Costas · vista lateral',prop:'halteres',level:'iniciante',foot:{x:430,y:floor},
  muscles:'Latíssimo do dorso, trapézio médio, romboides, deltoide posterior e bíceps',
  start:{shin:8,thigh:-28,torso:62,arm:180,forearm:180,head:20},
  phases:[
   {label:'Puxar',cues:['Tronco inclinado, coluna neutra','Leve os halteres até a cintura','Cotovelos para trás, junto ao corpo'],breath:'expire',seconds:1,pose:{shin:8,thigh:-28,torso:62,arm:285,forearm:182,head:20}},
   {label:'Pausa',cues:['Aproxime as escápulas por 1 segundo'],breath:'mantenha',seconds:.6,pose:{shin:8,thigh:-28,torso:62,arm:285,forearm:182,head:20}},
   {label:'Descer',cues:['Estenda os braços com controle'],breath:'inspire',seconds:2,pose:{shin:8,thigh:-28,torso:62,arm:180,forearm:180,head:20}},
  ]},
 {id:'puxada-frontal',name:'Puxada frontal no pulley',subtitle:'Costas · vista lateral',prop:'puxador',level:'iniciante',zoom:.8,foot:{x:640,y:floor},cable:{x:470,y:0},
  scenery:[{rect:[300,660,200,40]},{rect:[560,560,70,40]},{line:[400,700,400,860],width:24}],
  muscles:'Latíssimo do dorso, redondo maior, bíceps e trapézio inferior',
  start:{shin:0,thigh:-90,torso:-8,handRel:{x:40,y:-262},bend:1},
  phases:[
   {label:'Puxar',cues:['Peito aberto, leve inclinação para trás','Puxe a barra até a parte de cima do peito','Cotovelos para baixo e para trás'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:-90,torso:-14,handRel:{x:60,y:20},bend:1,head:10}},
   {label:'Pausa',cues:['Aperte as escápulas para baixo'],breath:'mantenha',seconds:.6,pose:{shin:0,thigh:-90,torso:-14,handRel:{x:60,y:20},bend:1,head:10}},
   {label:'Subir',cues:['Volte devagar até estender os braços'],breath:'inspire',seconds:2,pose:{shin:0,thigh:-90,torso:-8,handRel:{x:40,y:-262},bend:1}},
  ]},
 {id:'remada-baixa',name:'Remada baixa no cabo',subtitle:'Costas · vista lateral',prop:'puxador',level:'iniciante',root:'quadril',foot:{x:0,y:0},hip:{x:380,y:760},cable:{x:868,y:770},
  // Banco, apoio dos pés e coluna da máquina; o cabo sai da roldana entre os pés.
  scenery:[{rect:[260,795,260,40]},{rect:[860,700,22,160]},{rect:[890,560,46,300]}],
  muscles:'Latíssimo do dorso, romboides, trapézio médio e bíceps',
  start:{thigh:-100,shin:-70,torso:18,handRel:{x:250,y:90},bend:1},
  phases:[
   {label:'Puxar',cues:['Coluna neutra, tronco firme','Puxe o puxador até o abdômen','Cotovelos para trás, junto ao corpo'],breath:'expire',seconds:1.2,pose:{thigh:-100,shin:-70,torso:-5,handRel:{x:85,y:150},bend:1}},
   {label:'Pausa',cues:['Aperte as escápulas'],breath:'mantenha',seconds:.6,pose:{thigh:-100,shin:-70,torso:-5,handRel:{x:85,y:150},bend:1}},
   {label:'Voltar',cues:['Estenda os braços com controle','Sem curvar a coluna'],breath:'inspire',seconds:2,pose:{thigh:-100,shin:-70,torso:18,handRel:{x:250,y:90},bend:1}},
  ]},
 {id:'superman',name:'Superman (extensão lombar no solo)',subtitle:'Lombar e glúteos · vista lateral',prop:'nenhum',level:'iniciante',root:'quadril',foot:{x:0,y:0},hip:{x:470,y:836},
  muscles:'Eretores da coluna, glúteo máximo e deltoide posterior',
  start:{thigh:90,shin:90,torso:90,arm:90,forearm:90,head:0},
  phases:[
   {label:'Elevar',cues:['Deitado de barriga para baixo','Eleve braços, peito e pernas juntos','Olhar para o chão'],breath:'expire',seconds:1.2,pose:{thigh:104,shin:100,torso:76,arm:68,forearm:68,head:0}},
   {label:'Segurar',cues:['Segure 2 segundos, glúteos contraídos'],breath:'mantenha',seconds:2,pose:{thigh:104,shin:100,torso:76,arm:68,forearm:68,head:0}},
   {label:'Descer',cues:['Volte devagar ao chão'],breath:'inspire',seconds:1.4,pose:{thigh:90,shin:90,torso:90,arm:90,forearm:90,head:0}},
  ]},
 // ---------- Ombros e braços ----------
 {id:'desenvolvimento-halteres',name:'Desenvolvimento com halteres (sentado)',subtitle:'Ombros · vista lateral',prop:'halteres',level:'iniciante',zoom:.8,foot:{x:640,y:floor},
  scenery:[{rect:[300,660,200,40]},{rect:[290,330,40,340],rotate:-4},{line:[400,700,400,860],width:24}],
  muscles:'Deltoide anterior e médio, tríceps e trapézio superior',
  start:{shin:0,thigh:-90,torso:-4,handRel:{x:30,y:-10},bend:1},
  phases:[
   {label:'Empurrar',cues:['Costas apoiadas no encosto','Empurre os halteres acima da cabeça'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:-90,torso:-4,handRel:{x:14,y:-262},bend:1}},
   {label:'Pausa',cues:['Braços estendidos, sem travar'],breath:'mantenha',seconds:.6,pose:{shin:0,thigh:-90,torso:-4,handRel:{x:14,y:-262},bend:1}},
   {label:'Descer',cues:['Desça até a altura das orelhas, com controle'],breath:'inspire',seconds:2,pose:{shin:0,thigh:-90,torso:-4,handRel:{x:30,y:-10},bend:1}},
  ]},
 {id:'elevacao-frontal',name:'Elevação frontal com halteres',subtitle:'Ombros · vista lateral',prop:'halteres',level:'iniciante',foot:{x:430,y:floor},
  muscles:'Deltoide anterior e peitoral maior (porção clavicular)',
  start:{shin:0,thigh:0,torso:0,arm:172,forearm:168},
  phases:[
   {label:'Subir',cues:['Braços quase estendidos','Eleve até a altura dos ombros','Sem balançar o tronco'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:0,torso:0,arm:92,forearm:86}},
   {label:'Pausa',cues:['Segure 1 segundo'],breath:'mantenha',seconds:.6,pose:{shin:0,thigh:0,torso:0,arm:92,forearm:86}},
   {label:'Descer',cues:['Desça devagar'],breath:'inspire',seconds:2,pose:{shin:0,thigh:0,torso:0,arm:172,forearm:168}},
  ]},
 {id:'rosca-direta-halteres',name:'Rosca direta com halteres',subtitle:'Bíceps · vista lateral',prop:'halteres',level:'iniciante',foot:{x:450,y:floor},
  muscles:'Bíceps braquial, braquial e braquiorradial',
  start:{shin:0,thigh:0,torso:0,arm:178,forearm:176},
  phases:[
   {label:'Subir',cues:['Cotovelos colados ao corpo','Suba o halter dobrando só o cotovelo'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:0,torso:0,arm:176,forearm:28}},
   {label:'Pausa',cues:['Contraia o bíceps no alto'],breath:'mantenha',seconds:.6,pose:{shin:0,thigh:0,torso:0,arm:176,forearm:28}},
   {label:'Descer',cues:['Desça devagar até estender o braço'],breath:'inspire',seconds:2,pose:{shin:0,thigh:0,torso:0,arm:178,forearm:176}},
  ]},
 {id:'triceps-frances',name:'Tríceps francês com halter',subtitle:'Tríceps · vista lateral',prop:'halteres',level:'iniciante',zoom:.72,foot:{x:470,y:floor},
  muscles:'Tríceps braquial (cabeça longa)',
  start:{shin:0,thigh:0,torso:0,arm:-6,forearm:-4},
  phases:[
   {label:'Descer',cues:['Halter acima da cabeça','Cotovelos apontados para cima','Desça o halter atrás da cabeça'],breath:'inspire',seconds:2,pose:{shin:0,thigh:0,torso:0,arm:-8,forearm:-160}},
   {label:'Subir',cues:['Estenda os cotovelos sem abrir os braços'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:0,torso:0,arm:-6,forearm:-4}},
   {label:'Pausa',cues:['Braço estendido, abdômen firme'],breath:'mantenha',seconds:.6,pose:{shin:0,thigh:0,torso:0,arm:-6,forearm:-4}},
  ]},
 {id:'triceps-testa',name:'Tríceps testa com barra',subtitle:'Tríceps · vista lateral',prop:'barra',level:'intermediario',foot:{x:720,y:floor},
  scenery:[{rect:[180,700,360,36]},{line:[260,736,260,860],width:22},{line:[480,736,480,860],width:22}],
  muscles:'Tríceps braquial',
  start:{shin:0,thigh:-90,torso:-90,arm:-12,forearm:-10},
  phases:[
   {label:'Descer',cues:['Braços apontados para o teto','Dobre só os cotovelos, barra em direção à testa'],breath:'inspire',seconds:2,pose:{shin:0,thigh:-90,torso:-90,arm:-14,forearm:-150}},
   {label:'Subir',cues:['Estenda os cotovelos sem mexer os ombros'],breath:'expire',seconds:1.2,pose:{shin:0,thigh:-90,torso:-90,arm:-12,forearm:-10}},
   {label:'Pausa',cues:['Braços estendidos'],breath:'mantenha',seconds:.6,pose:{shin:0,thigh:-90,torso:-90,arm:-12,forearm:-10}},
  ]},
 // ---------- Core ----------
 {id:'prancha',name:'Prancha',subtitle:'Core · vista lateral',prop:'nenhum',level:'iniciante',foot:{x:200,y:floor},
  muscles:'Reto do abdômen, transverso do abdômen, oblíquos e glúteos',
  start:{shin:79,thigh:79,torso:79,hand:{x:850,y:850},bend:1,head:8},
  phases:[
   {label:'Posicionar',cues:['Antebraços no chão, cotovelos sob os ombros','Corpo reto da cabeça aos pés'],breath:'livre',seconds:1.5,pose:{shin:79,thigh:79,torso:79,hand:{x:850,y:850},bend:1,head:8}},
   {label:'Segurar',cues:['Contraia abdômen e glúteos','Não deixe o quadril cair nem subir','Segure de 20 a 60 segundos'],breath:'livre',seconds:3,pose:{shin:79,thigh:79,torso:79.5,hand:{x:850,y:850},bend:1,head:8}},
  ]},
 {id:'abdominal-crunch',name:'Abdominal (crunch)',subtitle:'Abdômen · vista lateral',prop:'nenhum',level:'iniciante',foot:{x:760,y:floor},
  muscles:'Reto do abdômen e oblíquos',
  start:{shin:-25,thigh:-135,torso:-90,arm:72,forearm:72,head:0},
  phases:[
   {label:'Subir',cues:['Joelhos dobrados, pés no chão','Tire os ombros do chão enrolando o tronco','Lombar apoiada'],breath:'expire',seconds:1.2,pose:{shin:-25,thigh:-135,torso:-62,arm:76,forearm:76,head:20}},
   {label:'Pausa',cues:['Contraia o abdômen por 1 segundo'],breath:'mantenha',seconds:.6,pose:{shin:-25,thigh:-135,torso:-62,arm:76,forearm:76,head:20}},
   {label:'Descer',cues:['Volte devagar, sem relaxar totalmente'],breath:'inspire',seconds:1.6,pose:{shin:-25,thigh:-135,torso:-90,arm:72,forearm:72,head:0}},
  ]},
 {id:'elevacao-de-pernas',name:'Elevação de pernas',subtitle:'Abdômen inferior · vista lateral',prop:'nenhum',level:'intermediario',root:'quadril',foot:{x:0,y:0},hip:{x:560,y:836},
  muscles:'Reto do abdômen (porção inferior), iliopsoas e oblíquos',
  start:{thigh:-92,shin:-92,torso:-90,arm:90,forearm:90},
  phases:[
   {label:'Subir',cues:['Deitado, mãos ao lado do corpo','Eleve as pernas estendidas até 90°','Lombar colada no chão'],breath:'expire',seconds:1.5,pose:{thigh:180,shin:180,torso:-90,arm:90,forearm:90}},
   {label:'Descer',cues:['Desça devagar, sem encostar os pés no chão'],breath:'inspire',seconds:2,pose:{thigh:-98,shin:-98,torso:-90,arm:90,forearm:90}},
  ]},
]

// Nomes que o profissional ou a IA podem usar para cada animação (sem acento, minúsculas).
const aliases:Record<string,string[]>={
 'agachamento-barra':['agachamento com barra','agachamento livre com barra','back squat'],
 'agachamento-goblet':['agachamento goblet','agachamento goblet com halter','goblet squat','agachamento com halter'],
 'afundo':['afundo','avanco','passada','afundo alternado','lunge','afundo com halteres'],
 'levantamento-terra':['levantamento terra','terra','deadlift','levantamento terra com barra'],
 'stiff-barra':['stiff','stiff com barra','levantamento terra romeno','stiff com halteres','romanian deadlift'],
 'panturrilha-em-pe':['panturrilha','panturrilha em pe','elevacao de panturrilha','gemeos em pe','calf raise'],
 'cadeira-extensora':['cadeira extensora','extensora','leg extension'],
 'mesa-flexora':['mesa flexora','flexora deitada','flexora','leg curl'],
 'leg-press-45':['leg press','leg press 45','leg press 45 graus'],
 'elevacao-pelvica-barra':['elevacao pelvica','elevacao pelvica com barra','hip thrust'],
 'supino-reto-barra':['supino reto','supino reto com barra','supino','bench press'],
 'supino-reto-halteres':['supino reto com halteres','supino com halteres'],
 'supino-inclinado-halteres':['supino inclinado','supino inclinado com halteres','supino inclinado com barra'],
 'flexao-inclinada':['flexao inclinada','flexao com maos no banco','flexao no banco'],
 'remada-curvada-halteres':['remada curvada com halteres','remada com halteres','remada unilateral','remada unilateral com halter','serrote'],
 'puxada-frontal':['puxada frontal','puxada na frente','puxada alta','pulley frente','puxada no pulley','lat pulldown'],
 'remada-baixa':['remada baixa','remada sentada','remada baixa no cabo','remada no cabo','seated row'],
 'superman':['superman','extensao lombar','lombar no solo'],
 'desenvolvimento-halteres':['desenvolvimento','desenvolvimento com halteres','desenvolvimento sentado','desenvolvimento de ombros','shoulder press'],
 'elevacao-frontal':['elevacao frontal','elevacao frontal com halteres','front raise'],
 'rosca-direta-halteres':['rosca direta','rosca direta com halteres','rosca alternada','rosca martelo','rosca biceps','biceps curl','rosca direta com barra'],
 'triceps-frances':['triceps frances','triceps frances com halter','triceps acima da cabeca','overhead triceps extension'],
 'triceps-testa':['triceps testa','triceps testa com barra','skull crusher'],
 'prancha':['prancha','prancha frontal','prancha abdominal','plank'],
 'abdominal-crunch':['abdominal','abdominal crunch','crunch','abdominal supra','abdominal reto'],
 'elevacao-de-pernas':['elevacao de pernas','abdominal infra','elevacao de pernas deitado','leg raise'],
 'remada-curvada-barra':['remada curvada','remada curvada com barra','remada curvada barra','bent over row'],
 'agachamento-livre':['agachamento','agachamento livre','agachamento com peso corporal','agachamento sem peso','squat'],
 'flexao-de-braco':['flexao','flexao de braco','flexao de bracos','flexao no solo','push up','push-up'],
 'elevacao-de-quadril':['elevacao de quadril','ponte','ponte de gluteo','ponte de gluteos','elevacao pelvica','glute bridge'],
}
export const normalizeName=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 -]/g,' ').replace(/\s+/g,' ').trim()
// Palavras que não ajudam a distinguir exercícios.
const stop=new Set(['com','de','do','da','no','na','nos','nas','em','o','a','os','as','e','para','um','uma','livre','maquina','aparelho','sentado','em pe','pe'])
const tokens=(text:string)=>normalizeName(text.replace(/\([^)]*\)/g,' ')).split(' ').filter(t=>t.length>1&&!stop.has(t))
// Procura pelo nome exato, por um apelido e, por fim, por semelhança de palavras
// (ex.: "Agachamento goblet" → "Agachamento goblet com halter"; "Supino com halteres" → "Supino reto com halteres").
export function findAnimation(name:string):ExerciseAnimation|null{
 const key=normalizeName(name)
 if(!key)return null
 for(const ex of exerciseAnimations){if(normalizeName(ex.name)===key||(aliases[ex.id]||[]).includes(key))return ex}
 const want=tokens(name)
 if(!want.length)return null
 let best:ExerciseAnimation|null=null,bestScore=0
 for(const ex of exerciseAnimations){
  for(const candidate of [ex.name,...(aliases[ex.id]||[])]){
   const have=tokens(candidate);if(!have.length)continue
   const shared=want.filter(t=>have.includes(t)).length
   // Todas as palavras do nome escrito precisam estar no da biblioteca, e a primeira (o movimento) precisa bater.
   // Palavras a mais no nome escrito (ex.: "sumô") indicam outro exercício, então não aceitamos.
   if(want[0]!==have[0]||shared<want.length)continue
   const score=shared/Math.max(want.length,have.length)
   if(score>bestScore){best=ex;bestScore=score}
  }
 }
 return bestScore>=0.5?best:null
}
