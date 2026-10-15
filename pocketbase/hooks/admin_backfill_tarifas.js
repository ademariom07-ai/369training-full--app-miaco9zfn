// Legacy backfill charged by completion/current plan, without verified settlement
// or mutual reviews. Retired until historical snapshots and ledger reconciliation
// can be handled by the same authenticated, idempotent settlement flow.
routerAdd('POST','/backend/v1/admin/backfill_tarifas',(c)=>{
 if(!c.auth)return c.json(401,{status:'error',code:'UNAUTHORIZED',message:'Autenticação necessária.'})
 if(c.auth.getString('role')!=='admin')return c.json(403,{status:'error',code:'FORBIDDEN',message:'Acesso restrito a administradores.'})
 return c.json(503,{status:'error',code:'LEGACY_FEE_BACKFILL_DISABLED',message:'Recuperação automática de tarifas indisponível: requer pagamento conciliado, avaliação mútua e plano histórico. Nenhum débito ou recálculo foi executado.'})
},$apis.requireAuth())
