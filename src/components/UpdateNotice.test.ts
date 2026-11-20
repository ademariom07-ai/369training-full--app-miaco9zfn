import {it,expect} from 'vitest'
import {fetchPublishedBuild} from './UpdateNotice'
const res=(body:unknown,ok=true)=>(async()=>({ok,json:async()=>body}))as unknown as typeof fetch
it('lê a versão publicada e ignora respostas inválidas',async()=>{
 expect(await fetchPublishedBuild(res({build:'20261120200442'}))).toBe('20261120200442')
 expect(await fetchPublishedBuild(res({build:42}))).toBeNull()
 expect(await fetchPublishedBuild(res({},false))).toBeNull()
 expect(await fetchPublishedBuild((async()=>{throw Error('offline')}) as unknown as typeof fetch)).toBeNull()
})
