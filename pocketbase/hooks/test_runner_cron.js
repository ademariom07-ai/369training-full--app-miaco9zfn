cronAdd('test_seed_loadtest_once', '* * * * *', () => {
  try {
    const adminUser = $app.findAuthRecordByEmail('users', 'ademariom07@gmail.com')
    if (!adminUser) {
      console.log('[TEST_CRON] Admin user nao encontrado')
      cronRemove('test_seed_loadtest_once')
      return
    }

    const token = adminUser.newAuthToken()
    const baseUrl = 'http://127.0.0.1:8090'

    const resSeed = $http.send({
      url: baseUrl + '/backend/v1/admin/seed_loadtest',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: token,
      },
      data: JSON.stringify({
        count: 10,
        batch: 5,
        cursor: 0,
        seed_id: 'LTTESTE',
      }),
      timeout: 10,
    })

    console.log('[TEST_CRON] SEED RES STATUS:', resSeed.statusCode, 'BODY:', resSeed.raw)

    const resClean = $http.send({
      url: baseUrl + '/backend/v1/admin/seed_loadtest_cleanup',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: token,
      },
      data: JSON.stringify({}),
      timeout: 10,
    })

    console.log('[TEST_CRON] CLEANUP RES STATUS:', resClean.statusCode, 'BODY:', resClean.raw)
  } catch (e) {
    console.error('[TEST_CRON] ERRO:', e)
  } finally {
    try {
      cronRemove('test_seed_loadtest_once')
    } catch (_) {}
  }
})
