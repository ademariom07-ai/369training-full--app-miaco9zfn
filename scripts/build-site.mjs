import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Monta o site completo para publicação em dist-site/:
// 1) build da área real (Supabase) a partir de acesso.html + src/;
// 2) cópia do pacote estático do site (site/: brand.css, páginas de demonstração, imagens, fontes).
// Não publica nada: só gera a pasta.
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist-site');
const vite = path.join(root, 'node_modules', '.bin', 'vite');

if (!existsSync(vite)) {
  console.error('Dependências ausentes. Execute pnpm install --frozen-lockfile antes do build.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
const build = spawnSync(vite, ['build', '--config', 'vite.access.config.ts', '--outDir', out], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});
if (build.error || build.status !== 0) {
  console.error('Build da área real falhou.');
  process.exit(1);
}

// O acesso.html gerado pelo build prevalece sobre qualquer cópia antiga.
cpSync(path.join(root, 'site'), out, {
  recursive: true,
  filter: (src) => path.basename(src) !== 'acesso.html',
});

for (const required of ['acesso.html', 'brand.css', 'index.html']) {
  if (!existsSync(path.join(out, required))) {
    console.error('Arquivo obrigatório ausente no site montado: ' + required);
    process.exit(1);
  }
}
console.log('\nSite montado em dist-site/ (área real + páginas do site).');
