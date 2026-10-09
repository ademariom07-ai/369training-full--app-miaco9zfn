import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
import ts from 'typescript'
// Source contract: removing the UI call is not backend authorization or deployment.
for(const path of ['src/pages/admin/AdminRankingConfig.tsx','src/pages/admin/AdminDashboard.tsx']){
 it(`${path} cannot invoke retired monthly closing endpoints`,()=>{
  const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const invoked:string[]=[]
  function visit(node:ts.Node){if(ts.isCallExpression(node))for(const argument of node.arguments)if(ts.isStringLiteralLike(argument))invoked.push(argument.text);ts.forEachChild(node,visit)}
  visit(source)
  expect(invoked).not.toContain('/backend/v1/admin/close_cycle')
  expect(invoked).not.toContain('/backend/v1/admin/fechamento_mensal')
 })
}
