import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {expect,it} from 'vitest'

// Contract test of migration and rules. This is not a PocketBase HTTP test.
function migration(direction:'up'|'down'='up'){
 const collection={listRule:'',viewRule:'',createRule:'admin-write',updateRule:'admin-write',deleteRule:'admin-write'}
 let saved=0
 runInNewContext(readFileSync('pocketbase/migrations/0065_restrict_administrative_split_config.js','utf8'),{
  migrate:(up:(app:unknown)=>void,down:(app:unknown)=>void)=>(direction==='up'?up:down)({findCollectionByNameOrId:(name:string)=>{expect(name).toBe('platform_config');return collection},save:(value:unknown)=>{expect(value).toBe(collection);saved++}}),
 })
 expect(saved).toBe(1)
 return collection
}
function allows(rule:string,id:string,role:string,key:string){
 const expression=rule.replaceAll('@request.auth.id','id').replaceAll('@request.auth.role','role').replace(/(?<!!)=/g,'===')
 return runInNewContext(expression,{id,role,key})
}
it('protects all administrative and unknown keys for students professionals and anonymous clients',()=>{
 const rules=migration()
 for(const rule of [rules.listRule,rules.viewRule])for(const key of ['revenue_split','pool_feed_config','new_financial_secret']){
  expect(allows(rule,'admin-id','admin',key)).toBe(true)
  for(const role of ['aluno','profissional',''])expect(allows(rule,'user',role,key)).toBe(false)
  expect(allows(rule,'','admin',key)).toBe(false)
 }
})
it('retains only the explicitly required operational keys for authenticated participants',()=>{
 const rules=migration()
 for(const key of ['dpo_config','pix_config','min_services_to_validate_referral'])for(const rule of [rules.listRule,rules.viewRule]){
  expect(allows(rule,'user','aluno',key)).toBe(true)
  expect(allows(rule,'user','profissional',key)).toBe(true)
  expect(allows(rule,'','',key)).toBe(false)
 }
 expect(rules.createRule).toBe('admin-write');expect(rules.updateRule).toBe('admin-write');expect(rules.deleteRule).toBe('admin-write')
})
it('rollback fails closed instead of exposing financial configuration again',()=>{
 const rules=migration('down')
 expect(allows(rules.listRule,'user','aluno','revenue_split')).toBe(false)
 expect(allows(rules.viewRule,'user','profissional','pix_config')).toBe(false)
 expect(allows(rules.viewRule,'admin','admin','revenue_split')).toBe(true)
})
it('exported schema uses the same restricted list and detail rules',()=>{
 const schema=JSON.parse(readFileSync('src/lib/pocketbase/schema.json','utf8'))
 const collections=Array.isArray(schema)?schema:schema.collections
 const config=collections.find((c:{name:string})=>c.name==='platform_config')
 const rules=migration()
 expect(config.apiRules.list).toBe(rules.listRule)
 expect(config.apiRules.view).toBe(rules.viewRule)
})
