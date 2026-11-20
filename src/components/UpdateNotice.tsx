import React,{useEffect,useState} from 'react'

// Avisa quando uma versão nova do app foi publicada (compara com /version.json) e recarrega com um toque.
// Verifica ao abrir, ao voltar para o app e a cada 5 minutos. Em desenvolvimento não faz nada.
const current=import.meta.env.VITE_BUILD_ID as string|undefined
export async function fetchPublishedBuild(fetcher:typeof fetch=fetch):Promise<string|null>{
 try{const r=await fetcher('/version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return null
  const body=await r.json() as {build?:unknown};return typeof body.build==='string'&&body.build.length<40?body.build:null}catch{return null}
}
export default function UpdateNotice(){
 const [available,setAvailable]=useState(false)
 useEffect(()=>{if(!current||current==='dev')return
  let alive=true
  const check=async()=>{const build=await fetchPublishedBuild();if(alive&&build&&build!==current)setAvailable(true)}
  const onVisible=()=>{if(document.visibilityState==='visible')void check()}
  void check();const id=setInterval(()=>void check(),5*60*1000);document.addEventListener('visibilitychange',onVisible)
  return()=>{alive=false;clearInterval(id);document.removeEventListener('visibilitychange',onVisible)}},[])
 if(!available)return null
 async function update(){try{const reg=await navigator.serviceWorker?.getRegistration();await reg?.update()}catch{/* sem service worker */}location.reload()}
 return <div role="status" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-[12px_30px_12px_30px] border border-[#a5ce41] bg-[#33325a] p-4 text-[#f7f6f2] shadow-lg">
  <span className="font-semibold">Há uma versão nova do 369 WELLNESS.</span>
  <span className="flex gap-2"><button type="button" onClick={()=>void update()} className="min-h-11 rounded-[10px_22px_10px_22px] bg-[#a5ce41] px-4 font-extrabold text-[#33325a]">Atualizar agora</button>
   <button type="button" onClick={()=>setAvailable(false)} className="min-h-11 rounded-[10px_22px_10px_22px] px-3 !text-[#f7f6f2] underline">Depois</button></span>
 </div>
}
