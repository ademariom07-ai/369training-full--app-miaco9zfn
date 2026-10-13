/// <reference path="../pb_data/types.d.ts" />

// Foto de perfil: o app passa a permitir troca de foto (AvatarUploader).
// - Aceita só JPG, PNG e WEBP (SVG pode conter scripts);
// - Limite de 5 MB por arquivo;
// - Miniaturas para o cabeçalho e as listas.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const avatar = users.fields.getByName('avatar')
    if (avatar) {
      avatar.mimeTypes = ['image/jpeg', 'image/png', 'image/webp']
      avatar.maxSize = 5 * 1024 * 1024
      avatar.thumbs = ['64x64', '200x200']
      app.save(users)
    }
  },
  (app) => {
    // Sem rollback automático: reverter voltaria a aceitar SVG.
  },
)
