migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['aluno', 'profissional', 'admin'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('plan')) {
      users.fields.add(
        new SelectField({
          name: 'plan',
          values: ['gratis', 'basico', 'pro', 'premium'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('plan_type')) {
      users.fields.add(
        new SelectField({
          name: 'plan_type',
          values: ['aluno', 'profissional'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('approved')) {
      users.fields.add(
        new BoolField({
          name: 'approved',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('bio')) {
      users.fields.add(
        new TextField({
          name: 'bio',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('cref')) {
      users.fields.add(
        new TextField({
          name: 'cref',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('specialties')) {
      users.fields.add(
        new SelectField({
          name: 'specialties',
          values: ['Educação Física', 'Nutrição', 'Fisioterapia', 'Artes Marciais'],
          maxSelect: 4,
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('latitude')) {
      users.fields.add(
        new NumberField({
          name: 'latitude',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('longitude')) {
      users.fields.add(
        new NumberField({
          name: 'longitude',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('city')) {
      users.fields.add(
        new TextField({
          name: 'city',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('state')) {
      users.fields.add(
        new TextField({
          name: 'state',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('address')) {
      users.fields.add(
        new TextField({
          name: 'address',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('phone')) {
      users.fields.add(
        new TextField({
          name: 'phone',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('rating_avg')) {
      users.fields.add(
        new NumberField({
          name: 'rating_avg',
          min: 0,
          max: 5,
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('referral_code')) {
      users.fields.add(
        new TextField({
          name: 'referral_code',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('objective')) {
      users.fields.add(
        new TextField({
          name: 'objective',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('professional_type')) {
      users.fields.add(
        new TextField({
          name: 'professional_type',
          required: false,
        }),
      )
    }

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const fieldNames = [
      'role',
      'plan',
      'plan_type',
      'approved',
      'bio',
      'cref',
      'specialties',
      'latitude',
      'longitude',
      'city',
      'state',
      'address',
      'phone',
      'rating_avg',
      'referral_code',
      'objective',
      'professional_type',
    ]
    for (const name of fieldNames) {
      const f = users.fields.getByName(name)
      if (f) users.fields.removeByName(name)
    }
    app.save(users)
  },
)
