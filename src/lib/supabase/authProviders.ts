// Consulta pública do Supabase Auth: quais provedores (Google, Apple...) estão ligados no painel.
// Assim o botão só aparece depois que o provedor foi configurado. Em caso de falha, esconde.
export async function enabledProviders(fetcher:typeof fetch=fetch):Promise<Set<string>>{
 const url=import.meta.env.VITE_SUPABASE_URL?.trim(),key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
 if(!url||!key)return new Set()
 try{
  const response=await fetcher(new URL('/auth/v1/settings',url).href,{headers:{apikey:key}})
  if(!response.ok)return new Set()
  const body=await response.json() as {external?:Record<string,unknown>}
  return new Set(Object.entries(body.external??{}).filter(([,on])=>on===true).map(([name])=>name))
 }catch{return new Set()}
}
