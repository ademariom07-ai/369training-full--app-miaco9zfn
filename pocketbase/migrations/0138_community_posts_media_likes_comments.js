// Migração 0138 — Comunidade real: posts persistidos com mídia, curtidas e comentários.
// 1. `community_posts`: campo de arquivo `media` (imagem ou vídeo até 50 MB, jpg/png/webp/mp4/webm),
//    `reported`/`report_reason` (moderação reaproveitada dos chats) e índices de feed.
//    Regras de acesso reforçadas: cada usuário edita/apaga apenas os próprios posts.
// 2. Nova coleção `community_post_likes` (1 curtida por usuário por post, unique index).
// 3. Nova coleção `community_post_comments` (comentários persistidos, autor só edita o próprio).

migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'

    // ---------------------------------------------------------------- community_posts
    const posts = app.findCollectionByNameOrId('community_posts')

    if (!posts.fields.getByName('media')) {
      posts.fields.add(
        new FileField({
          name: 'media',
          maxSelect: 1,
          maxSize: 52428800, // 50 MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
        }),
      )
    }

    if (!posts.fields.getByName('reported')) {
      posts.fields.add(new BoolField({ name: 'reported' }))
    }
    if (!posts.fields.getByName('report_reason')) {
      posts.fields.add(new TextField({ name: 'report_reason', max: 500 }))
    }

    // Regras de acesso: leitura para qualquer autenticado; escrita apenas do próprio autor.
    posts.listRule = "@request.auth.id != '' && reported = false"
    posts.viewRule = "@request.auth.id != '' && reported = false"
    posts.createRule =
      "@request.auth.id != '' && @request.body.user = @request.auth.id && @request.body.reported = false && @request.body.report_reason = ''"
    posts.updateRule =
      "@request.auth.id != '' && user = @request.auth.id && @request.body.user = @request.auth.id && @request.body.reported = false && @request.body.report_reason = ''"
    posts.deleteRule = "@request.auth.id != '' && user = @request.auth.id"

    posts.addIndex('idx_community_posts_created', false, 'created', '')
    app.save(posts)

    // ---------------------------------------------------------- community_post_likes
    const likes = new Collection({
      name: 'community_post_likes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && @request.body.user = @request.auth.id && @request.body.post != ''",
      updateRule: null,
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'post',
          type: 'relation',
          required: true,
          collectionId: posts.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_community_likes_unique ON community_post_likes (post, user)',
        'CREATE INDEX idx_community_likes_post ON community_post_likes (post)',
      ],
    })
    app.save(likes)

    // ------------------------------------------------------- community_post_comments
    const comments = new Collection({
      name: 'community_post_comments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && @request.body.user = @request.auth.id && @request.body.post != ''",
      updateRule:
        "@request.auth.id != '' && user = @request.auth.id && @request.body.user = @request.auth.id && @request.body.post != ''",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'post',
          type: 'relation',
          required: true,
          collectionId: posts.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'content', type: 'text', required: true, min: 1, max: 1000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_community_comments_post ON community_post_comments (post, created)',
        'CREATE INDEX idx_community_comments_user ON community_post_comments (user)',
      ],
    })
    app.save(comments)
  },
  (app) => {
    const likes = app.findCollectionByNameOrId('community_post_likes')
    app.delete(likes)
    const comments = app.findCollectionByNameOrId('community_post_comments')
    app.delete(comments)
    const posts = app.findCollectionByNameOrId('community_posts')
    posts.fields.removeByName('media')
    posts.fields.removeByName('reported')
    posts.fields.removeByName('report_reason')
    posts.removeIndex('idx_community_posts_created')
    posts.listRule = "@request.auth.id != ''"
    posts.viewRule = "@request.auth.id != ''"
    posts.createRule = "@request.auth.id != '' && @request.body.user = @request.auth.id"
    posts.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (user = @request.auth.id && @request.body.user:isset = false))"
    posts.deleteRule =
      "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')"
    app.save(posts)
  },
)
