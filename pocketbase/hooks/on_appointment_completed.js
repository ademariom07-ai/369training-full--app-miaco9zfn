// Hook triggered whenever an appointment status changes to 'concluído'
// Automatically sync with 'services' collection and trigger cashback and referral flows
onRecordAfterUpdateSuccess((e) => {
  const appointment = e.record
  const oldStatus = e.oldRecord ? e.oldRecord.get('status') : ''
  const newStatus = appointment.get('status')

  if (newStatus !== 'concluído' || oldStatus === 'concluído') {
    return
  }

  const profId = appointment.get('profissional')
  const alunoId = appointment.get('aluno')
  const valor = appointment.get('valor') || 0
  const tipo = appointment.get('servico_tipo') || 'treino'

  try {
    const servicesCol = $app.findCollectionByNameOrId('services')
    const svc = new Record(servicesCol)
    svc.set('professional', profId)
    svc.set('student', alunoId)
    svc.set('type', tipo)
    svc.set('title', `Atendimento: ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`)
    svc.set('value', valor)
    svc.set('status', 'concluido')
    svc.set('completed_at', new Date().toISOString().replace('T', ' '))
    svc.set('notes', `Gerado automaticamente pelo agendamento #${appointment.id}`)
    $app.save(svc)
  } catch (err) {
    console.error('Erro ao sincronizar appointment concluído com services:', err)
  }
}, 'appointments')
