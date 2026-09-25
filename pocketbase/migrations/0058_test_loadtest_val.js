migrate(
  (app) => {
    const notifCol = app.findCollectionByNameOrId('notifications')
    const rec = new Record(notifCol)
    rec.set('user', '0n68vyy8isuevlj')
    rec.set('type', 'system')
    rec.set('title', 'TEST_LOADTEST_VAL')
    rec.set('body', 'pending')
    rec.set('read', false)
    app.save(rec)
  },
  (app) => {
    try {
      const recs = app.findRecordsByFilter(
        'notifications',
        "title = 'TEST_LOADTEST_VAL'",
        '-created',
        10,
        0,
      )
      for (const r of recs) {
        app.delete(r)
      }
    } catch (_) {}
  },
)
