import React,{useEffect,useState} from 'react'
import {Download,Share} from 'lucide-react'
import {canPromptInstall,isIos,isStandalone,onInstallChange,promptInstall} from '@/lib/pwa'

// Botão "Instalar app": Android/Chrome/Edge usam o convite do navegador; no iPhone mostramos o caminho manual.
export default function InstallApp({compact=false}:{compact?:boolean}){
 const [ready,setReady]=useState(canPromptInstall()),[help,setHelp]=useState(false)
 useEffect(()=>onInstallChange(()=>setReady(canPromptInstall())),[])
 if(isStandalone())return null
 const ios=isIos()
 if(!ready&&!ios)return null
 return <div className={compact?'':'rounded-[12px_30px_12px_30px] border border-[#dddee4] bg-white p-3'}>
  <button type="button" onClick={()=>{if(ready)void promptInstall();else setHelp(v=>!v)}} className="flex min-h-11 w-full items-center gap-3 rounded-[10px_22px_10px_22px] bg-[#a5ce41] px-3 text-sm font-bold text-[#33325a]">
   <Download aria-hidden="true" className="h-4 w-4"/>Instalar app 369 Wellness</button>
  {help&&ios&&<p className="mt-2 text-sm">No iPhone: toque em <Share aria-label="Compartilhar" className="inline h-4 w-4"/> <b>Compartilhar</b> (no Safari) e depois em <b>Adicionar à Tela de Início</b>.</p>}
 </div>
}
