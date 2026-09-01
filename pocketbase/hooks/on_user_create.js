// Hook triggered on user creation to auto-verify and assign Global Unique Tree Position & Level (Spillover up to Level 36)
onRecordCreate((e) => {
  try {
    e.record.setVerified(true)
  } catch (err) {
    console.log('Error auto-verifying user in onRecordCreate:', err ? err.message : '')
  }

  try {
    const existingPos = e.record.get('tree_position')
    if (!existingPos || Number(existingPos) <= 0) {
      // Find highest tree_position among all users
      const usersWithPos = $app.findRecordsByFilter(
        'users',
        'tree_position > 0',
        '-tree_position',
        1,
        0,
      )
      let nextPos = 1
      if (usersWithPos && usersWithPos.length > 0) {
        nextPos = Number(usersWithPos[0].get('tree_position')) + 1
      }

      e.record.set('tree_position', nextPos)

      // Calculate level: Nível n has capacity 2^(n-1), total accumulated is 2^n - 1
      let lvl = 1
      while (lvl < 36 && Math.pow(2, lvl) - 1 < nextPos) {
        lvl++
      }
      e.record.set('tree_level', lvl)
    }
  } catch (err) {
    console.error('Error assigning global tree position in on_user_create:', err)
  }

  return e.next()
}, 'users')
