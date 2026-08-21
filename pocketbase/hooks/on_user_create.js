onRecordCreate((e) => {
  try {
    e.record.setVerified(true)
  } catch (err) {
    console.log('Error auto-verifying user in onRecordCreate:', err ? err.message : '')
  }
  return e.next()
}, 'users')
