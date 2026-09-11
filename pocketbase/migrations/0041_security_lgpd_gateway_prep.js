migrate(
  (app) => {
    // 1. Atualizar campos em wallet_transactions:
    // comprovante_file (file: pdf, png, jpg), gateway_provider, gateway_tx_id, split_rules (json)
    const walletCol = app.findCollectionByNameOrId('wallet_transactions')
    if (!walletCol.fields.getByName('comprovante_file')) {
      walletCol.fields.add(
        new FileField({
          name: 'comprovante_file',
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        }),
      )
    }
    if (!walletCol.fields.getByName('gateway_provider')) {
      walletCol.fields.add(
        new TextField({
          name: 'gateway_provider',
        }),
      )
    }
    if (!walletCol.fields.getByName('gateway_tx_id')) {
      walletCol.fields.add(
        new TextField({
          name: 'gateway_tx_id',
        }),
      )
    }
    if (!walletCol.fields.getByName('split_rules')) {
      walletCol.fields.add(
        new JSONField({
          name: 'split_rules',
        }),
      )
    }
    // Proteger wallet_transactions: criação direta pelo frontend proibida exceto admin/hooks do backend
    walletCol.createRule = "@request.auth.role = 'admin'"
    walletCol.updateRule = "@request.auth.role = 'admin'"
    walletCol.deleteRule = "@request.auth.role = 'admin'"
    walletCol.listRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    walletCol.viewRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    app.save(walletCol)

    // 2. Atualizar users: birth_date, guardian_id, guardian_name, guardian_cpf, guardian_consent
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('birth_date')) {
      usersCol.fields.add(
        new DateField({
          name: 'birth_date',
        }),
      )
    }
    if (!usersCol.fields.getByName('guardian_id')) {
      usersCol.fields.add(
        new RelationField({
          name: 'guardian_id',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }
    if (!usersCol.fields.getByName('guardian_name')) {
      usersCol.fields.add(
        new TextField({
          name: 'guardian_name',
        }),
      )
    }
    if (!usersCol.fields.getByName('guardian_cpf')) {
      usersCol.fields.add(
        new TextField({
          name: 'guardian_cpf',
        }),
      )
    }
    if (!usersCol.fields.getByName('guardian_consent')) {
      usersCol.fields.add(
        new BoolField({
          name: 'guardian_consent',
        }),
      )
    }
    if (!usersCol.fields.getByName('cpf')) {
      usersCol.fields.add(
        new TextField({
          name: 'cpf',
        }),
      )
    }

    // Regra da Tarefa 2: "Ajustar a API rule da coleção users para que o usuário NÃO possa alterar o próprio campo plan (self-update liberado apenas para: bio, avatar, phone, city, state, address, objective, video_url)"
    // PocketBase updateRule valida se os campos sensíveis não foram alterados via @request.body:
    usersCol.updateRule =
      "@request.auth.role = 'admin' || (" +
      'id = @request.auth.id && ' +
      '@request.body.plan:isset = false && ' +
      '@request.body.role:isset = false && ' +
      '@request.body.approved:isset = false && ' +
      '@request.body.tree_position:isset = false && ' +
      '@request.body.tree_level:isset = false' +
      ')'
    app.save(usersCol)

    // 3. Criar coleção access_logs (user, ip, user_agent, path, created, updated)
    if (!app.hasTable('access_logs')) {
      const accessLogsCol = new Collection({
        name: 'access_logs',
        type: 'base',
        listRule: "@request.auth.role = 'admin'",
        viewRule: "@request.auth.role = 'admin'",
        createRule: "@request.auth.id != '' || @request.body.path != ''",
        updateRule: null,
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'user',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'ip', type: 'text' },
          { name: 'user_agent', type: 'text' },
          { name: 'path', type: 'text', required: true },
          { name: 'method', type: 'text' },
          { name: 'details', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_access_logs_user ON access_logs (user)',
          'CREATE INDEX idx_access_logs_created ON access_logs (created DESC)',
          'CREATE INDEX idx_access_logs_path ON access_logs (path)',
        ],
      })
      app.save(accessLogsCol)
    }

    // 4. Inserir valores padrão em platform_config para pix_config e dpo_config
    const platCol = app.findCollectionByNameOrId('platform_config')
    try {
      app.findFirstRecordByData('platform_config', 'key', 'pix_config')
    } catch (_) {
      const pixRec = new Record(platCol)
      pixRec.set('key', 'pix_config')
      pixRec.set('description', 'Chave PIX e Titular da plataforma 369TRAINING para depósitos')
      pixRec.set('value', {
        pix_key: 'financeiro@369training.com',
        pix_holder: '369TRAINING LTDA',
        pix_type: 'EMAIL',
      })
      app.save(pixRec)
    }

    try {
      app.findFirstRecordByData('platform_config', 'key', 'dpo_config')
    } catch (_) {
      const dpoRec = new Record(platCol)
      dpoRec.set('key', 'dpo_config')
      dpoRec.set('description', 'Dados de contato do Encarregado de Proteção de Dados (DPO)')
      dpoRec.set('value', {
        name: 'DPO 369TRAINING',
        email: 'dpo@369training.com',
        phone: '+55 (11) 3690-0000',
        retention_period_months: 6,
      })
      app.save(dpoRec)
    }

    // 5. Atualizar Política de Privacidade com a retenção de 6 meses (MCI art. 15)
    try {
      const privDoc = app.findFirstRecordByData('legal_documents', 'slug', 'politica-privacidade')
      let bodyText = privDoc.getString('body') || ''
      if (!bodyText.includes('Artigo 15 do Marco Civil da Internet')) {
        bodyText +=
          '\n\n## 9. Registros de Acesso a Aplicações e Retenção Legal (Marco Civil da Internet, Art. 15)\n' +
          'Em estrito cumprimento ao **Artigo 15 da Lei nº 12.965/2014 (Marco Civil da Internet)**, a 369TRAINING mantém, em ambiente sigiloso, controlado e seguro, os **registros de acesso a aplicações de internet** (incluindo data, hora, endereço IP, user-agent e rotas de login e financeiras acessadas) pelo **prazo legal estrito de 6 (seis) meses**.\n' +
          'Decorrido o prazo regulamentar e esgotadas as finalidades fiscais ou de apuração de fraudes, tais logs são periodicamente anonimizados ou definitivamente expurgados dos nossos servidores de produção.'
        privDoc.set('body', bodyText)
        app.save(privDoc)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const logsCol = app.findCollectionByNameOrId('access_logs')
      app.delete(logsCol)
    } catch (_) {}
  },
)
