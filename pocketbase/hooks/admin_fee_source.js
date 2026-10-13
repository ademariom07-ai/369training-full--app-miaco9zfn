// Read-only administrative inventory. Registered wallet debits are NOT proof of settlement.
routerAdd('POST', '/backend/v1/admin/fee_source', (c) => {
  if (!c.auth) return c.json(401, {code:'UNAUTHORIZED'})
  if (c.auth.getString('role') !== 'admin') return c.json(403, {code:'FORBIDDEN'})
  const period = (c.requestInfo().body || {}).period
  if (typeof period !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) return c.json(400, {code:'INVALID_PERIOD'})
  // Explicit accounting window for this inventory only; does not define monthly closing policy.
  const parts=period.split('-'),year=Number(parts[0]),month=Number(parts[1])
  const from=period+'-01 03:00:00.000Z'
  const to=(month===12?year+1:year)+'-'+String(month===12?1:month+1).padStart(2,'0')+'-01 03:00:00.000Z'
  try {
    let summary
    $app.runInTransaction((txApp)=>{
      let students=0,partners=0,accepted=0,excluded=0,processed=0
      const seen=new Set(),references=new Set()
      for(let offset=0;;offset+=500){
        if(offset>=100000)throw new Error('INCOMPLETE_SOURCE')
        const rows=arrayOf(new DynamicModel({id:'',user:'',role:'',amount:0,status:'',reference_id:'',reference_type:''}))
        txApp.db().newQuery(`SELECT t.id,t.user,COALESCE(u.role,'') AS role,t.amount,t.status,t.reference_id,t.reference_type
          FROM wallet_transactions t LEFT JOIN users u ON u.id=t.user
          WHERE t.type='tarifa' AND t.created>={:from} AND t.created<{:to}
          ORDER BY t.created,t.id LIMIT 500 OFFSET {:offset}`).bind({from,to,offset}).all(rows)
        for(const row of rows){
          processed++
          if(!row.id||seen.has(row.id))throw new Error('DUPLICATE_SOURCE')
          seen.add(row.id)
          if(['pendente','cancelado','estornado'].includes(row.status)){excluded++;continue}
          if(row.status!=='concluido'||!['aluno','profissional'].includes(row.role)||!row.user||!row.reference_id||!row.reference_type)throw new Error('UNCLASSIFIED_SOURCE')
          const reference=JSON.stringify([row.user,row.reference_type,row.reference_id])
          if(references.has(reference))throw new Error('DUPLICATE_SOURCE')
          references.add(reference)
          if(typeof row.amount!=='number'||!Number.isFinite(row.amount)||row.amount>0)throw new Error('INVALID_AMOUNT')
          const scaled=-row.amount*100,cents=Math.round(scaled)
          if(!Number.isSafeInteger(cents)||Math.abs(scaled-cents)>0.000001)throw new Error('INVALID_AMOUNT')
          if(row.role==='aluno')students+=cents;else partners+=cents
          if(!Number.isSafeInteger(students+partners))throw new Error('INVALID_AMOUNT')
          accepted++
        }
        if(rows.length<500)break
      }
      const total=students+partners
      const indicativePool=Math.floor(total/100)*38+Math.round((total%100)*38/100)
      summary={period,windowFrom:from,windowTo:to,windowBasis:'created-UTC-minus-03',studentFeeCents:students,partnerFeeCents:partners,totalFeeCents:total,indicativePoolCents:indicativePool,percent:38,acceptedRecords:accepted,excludedRecords:excluded,processedRecords:processed,source:'pocketbase-wallet-registered-fees',complete:true,settlementVerified:false,usableForClosing:false,simulationOnly:true}
    })
    return c.json(200,summary)
  } catch (_) {
    // No database details, names, secrets or partial totals in error responses.
    return c.json(409,{code:'FEE_SOURCE_NOT_RECONCILED',message:'Não foi possível conferir todas as tarifas. Revise duplicidades, pagadores, valores e estados antes de usar esta fonte.'})
  }
},$apis.requireAuth())
