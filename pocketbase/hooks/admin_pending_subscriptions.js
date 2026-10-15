// Inventory only: no manual confirmation, activation, debit or gateway calls.
routerAdd('POST','/backend/v1/admin/pending_subscriptions',(c)=>{
 if(!c.auth)return c.json(401,{code:'UNAUTHORIZED'})
 if(c.auth.getString('role')!=='admin')return c.json(403,{code:'FORBIDDEN'})
 const period=(c.requestInfo().body||{}).period
 if(typeof period!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period))return c.json(400,{code:'INVALID_PERIOD'})
 const [year,month]=period.split('-').map(Number),from=period+'-01 03:00:00.000Z',to=(month===12?year+1:year)+'-'+String(month===12?1:month+1).padStart(2,'0')+'-01 03:00:00.000Z'
 try{
  let result
  $app.runInTransaction(tx=>{
   let count=0,amount=0,duplicates=0;const ids=new Set(),keys=new Set()
   for(let offset=0;;offset+=500){
    if(offset>=100000)throw Error('LIMIT')
    const rows=arrayOf(new DynamicModel({id:'',user:'',amount:0,reference_id:''}))
    tx.db().newQuery(`SELECT id,user,amount,reference_id FROM wallet_transactions
      WHERE type='mensalidade' AND status='pendente' AND reference_type='subscription'
      AND created>={:from} AND created<{:to} ORDER BY created,id LIMIT 500 OFFSET {:offset}`)
      .bind({from,to,offset}).all(rows)
    for(const row of rows){
     if(!row.id||ids.has(row.id)||!row.user||!row.reference_id||typeof row.amount!=='number'||!Number.isFinite(row.amount)||row.amount<=0)throw Error('INVALID')
     ids.add(row.id)
     const scaled=row.amount*100,cents=Math.round(scaled)
     if(!Number.isSafeInteger(cents)||Math.abs(scaled-cents)>0.000001)throw Error('INVALID')
     const key=JSON.stringify([row.user,row.reference_id]);if(keys.has(key))duplicates++;keys.add(key)
     amount+=cents;count++;if(!Number.isSafeInteger(amount))throw Error('OVERFLOW')
    }
    if(rows.length<500)break
   }
   result={period,pendingCount:count,pendingAmountCents:amount,duplicateReferenceCount:duplicates,complete:true,paymentConfirmed:false,activationAllowed:false,cashbackContributionCents:0}
  })
  return c.json(200,result)
 }catch(_){return c.json(409,{code:'PENDING_INVENTORY_UNAVAILABLE',message:'Não foi possível conferir todas as solicitações pendentes.'})}
},$apis.requireAuth())
