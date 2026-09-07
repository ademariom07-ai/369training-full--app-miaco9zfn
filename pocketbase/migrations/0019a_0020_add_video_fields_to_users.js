migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('video_url')) {
      users.fields.add(
        new TextField({
          name: 'video_url',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('video_enabled')) {
      users.fields.add(
        new BoolField({
          name: 'video_enabled',
          required: false,
        }),
      )
    }

    app.save(users)

    // Optional demo seed for existing seeded professionals
    try {
      const carlos = app.findAuthRecordByEmail('_pb_users_auth_', 'carlos.coach@369training.com')
      carlos.set('video_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      carlos.set('video_enabled', true)
      app.save(carlos)
    } catch (_) {}

    try {
      const marina = app.findAuthRecordByEmail('_pb_users_auth_', 'marina.fisio@369training.com')
      marina.set(
        'video_url',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      )
      marina.set('video_enabled', true)
      app.save(marina)
    } catch (_) {}
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (users.fields.getByName('video_url')) {
      users.fields.removeByName('video_url')
    }
    if (users.fields.getByName('video_enabled')) {
      users.fields.removeByName('video_enabled')
    }
    app.save(users)
  },
)
