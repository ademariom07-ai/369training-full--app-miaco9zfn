// App instalável (PWA): registra o service worker e guarda o convite de instalação do navegador,
// que pode chegar antes da tela montar.
type InstallPrompt=Event&{prompt:()=>Promise<void>,userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
let deferred:InstallPrompt|null=null
const listeners=new Set<()=>void>()
const notify=()=>listeners.forEach(fn=>fn())

export function setupPwa(){
 if(typeof window==='undefined')return
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event as InstallPrompt;notify()})
 window.addEventListener('appinstalled',()=>{deferred=null;notify()})
 if('serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})
}
export const canPromptInstall=()=>deferred!==null
export function onInstallChange(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}}
export async function promptInstall(){if(!deferred)return false;const event=deferred;deferred=null;notify();await event.prompt();return (await event.userChoice).outcome==='accepted'}
export function isStandalone(){
 if(typeof window==='undefined')return false
 return window.matchMedia?.('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true
}
export function isIos(){
 if(typeof navigator==='undefined')return false
 return /iphone|ipad|ipod/i.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1
}
