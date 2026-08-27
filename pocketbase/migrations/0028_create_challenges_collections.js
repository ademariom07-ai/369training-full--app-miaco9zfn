migrate(
  (app) => {
    // 1. challenges
    try {
      app.findCollectionByNameOrId('challenges')
    } catch (_) {
      const challenges = new Collection({
        name: 'challenges',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'description',
            type: 'text',
            required: false,
          },
          {
            name: 'professional_id',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'regras',
            type: 'text',
            required: false,
          },
          {
            name: 'dias_total',
            type: 'number',
            required: true,
          },
          {
            name: 'reward_badge',
            type: 'text',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: ['CREATE INDEX idx_challenges_prof ON challenges (professional_id)'],
      })
      app.save(challenges)
    }

    // 2. challenge_participants
    try {
      app.findCollectionByNameOrId('challenge_participants')
    } catch (_) {
      const challengesCol = app.findCollectionByNameOrId('challenges')
      const participants = new Collection({
        name: 'challenge_participants',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'challenge_id',
            type: 'relation',
            required: true,
            collectionId: challengesCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'aluno_id',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'dias_concluidos',
            type: 'json',
            required: false,
          },
          {
            name: 'completed',
            type: 'bool',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_cp_challenge ON challenge_participants (challenge_id)',
          'CREATE INDEX idx_cp_aluno ON challenge_participants (aluno_id)',
        ],
      })
      app.save(participants)
    }
  },
  (app) => {
    try {
      const participants = app.findCollectionByNameOrId('challenge_participants')
      app.delete(participants)
    } catch (_) {}
    try {
      const challenges = app.findCollectionByNameOrId('challenges')
      app.delete(challenges)
    } catch (_) {}
  },
)
