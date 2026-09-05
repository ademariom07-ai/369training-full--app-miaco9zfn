migrate(
  (app) => {
    // Test: create a rank record
    const rankCol = app.findCollectionByNameOrId('rank_entries')
    const rec = new Record(rankCol)
    rec.set('user', 'vhvun6ujx1esr19')
    rec.set('cycle', '2026-08')
    rec.set('points', 10)
    rec.set('services_count', 5)
    rec.set('referrals_count', 2)
    rec.set('stars', 4.9)
    rec.set('ranking_position', 1)
    app.save(rec)
  },
  (app) => {},
)
