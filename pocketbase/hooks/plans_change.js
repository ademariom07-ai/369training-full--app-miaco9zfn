// Plan selection is not proof of payment. Paid subscriptions remain pending
// until a server-authenticated payment adapter can settle and activate atomically.
routerAdd('POST', '/backend/v1/plans/change', (e) => {
  if (!e.auth) return e.json(401, {success:false,message:'Autenticação necessária.'})
  const body = e.requestInfo().body || {}
  if (typeof body.plan !== 'string' || (body.billing_period !== undefined && body.billing_period !== 'monthly')) {
    return e.json(400,{success:false,message:'Informe um plano e cobrança mensal.'})
  }
  const targetPlan=body.plan.toLowerCase()
  if (!['gratis','basico','pro','premium','pro_parceiro'].includes(targetPlan)) return e.json(400,{success:false,message:'Plano inválido.'})
  try {
    let response
    $app.runInTransaction((txApp) => {
      const user=txApp.findRecordById('users',e.auth.id)
      const role=user.getString('role')
      if (!['aluno','profissional'].includes(role) || user.get('approved') !== true) {response={code:403,body:{success:false,message:'Cadastro aprovado necessário.'}};return}
      if (role==='aluno' && targetPlan==='pro_parceiro') {response={code:400,body:{success:false,message:'PRO PARCEIRO é exclusivo do profissional.'}};return}
      if (role==='aluno' && user.getString('linked_professional')) {response={code:409,body:{success:false,message:'Aluno vinculado mantém isenção; alteração requer revisão do vínculo.'}};return}
      const currentPlan=user.getString('plan') || 'gratis'
      const now=new Date()
      if (currentPlan===targetPlan) {response={code:409,body:{success:false,message:'Plano já selecionado. Renovação deve usar a cobrança da assinatura.'}};return}
      // Preserve the existing commercial change window; no new billing at selection.
      const localDay=new Date(now.getTime()-3*60*60*1000).getUTCDate()
      if (role==='profissional' && currentPlan!=='gratis' && targetPlan!=='gratis' && localDay>3) {response={code:403,body:{success:false,message:'Troca entre planos pagos disponível nos dias 1 a 3.'}};return}
      const price=role==='aluno'?({gratis:0,basico:10,pro:20,premium:30})[targetPlan]:(targetPlan==='pro_parceiro'?149:0)
      if (price>0) {
        const pending=txApp.findRecordsByFilter('wallet_transactions',"user = {:user} && type = 'mensalidade' && status = 'pendente' && reference_type = 'subscription'",'created,id',2,0,{user:user.id})
        const reference=targetPlan+'_monthly'
        if (pending.length>1 || (pending.length===1 && (pending[0].getString('reference_id')!==reference || pending[0].get('amount')!==price))) {response={code:409,body:{success:false,message:'Há uma cobrança pendente diferente. Concilie ou cancele antes de trocar.'}};return}
        let tx=pending[0]
        if (!tx) {
          tx=new Record(txApp.findCollectionByNameOrId('wallet_transactions'))
          tx.set('user',user.id);tx.set('type','mensalidade');tx.set('amount',price);tx.set('status','pendente')
          tx.set('reference_type','subscription');tx.set('reference_id',reference)
          tx.set('description','Solicitação de mensalidade '+targetPlan+'; aguarda pagamento confirmado. Não é crédito disponível.')
          txApp.save(tx)
        }
        // Deliberately do not mutate plan, expiration, badge or subscription status.
        response={code:202,body:{success:true,status:'payment_pending',activated:false,payment_required:true,plan:currentPlan,requested_plan:targetPlan,price,transaction_id:tx.id,checkout_available:false,message:'Solicitação registrada. O plano atual foi mantido; a nova mensalidade depende de pagamento confirmado. Checkout ainda não integrado.'}}
        return
      }
      // Free plans and professional per-service plans have no monthly charge.
      user.set('plan',targetPlan);user.set('plan_upgraded_at',now.toISOString().replace('T',' '))
      user.set('subscription_status','ativa');user.set('subscription_expires_at','')
      txApp.save(user)
      response={code:200,body:{success:true,status:'active',activated:true,payment_required:false,plan:targetPlan,price:0,subscription_status:'ativa',message:role==='profissional'&&targetPlan!=='gratis'?'Plano selecionado sem mensalidade. Tarifa somente após validação do serviço.':'Plano gratuito selecionado.'}}
    })
    return e.json(response.code,response.body)
  } catch (_) {
    return e.json(500,{success:false,message:'Não foi possível registrar a solicitação de plano. Nenhuma ativação foi confirmada.'})
  }
},$apis.requireAuth())
