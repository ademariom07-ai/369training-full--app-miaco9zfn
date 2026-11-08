import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Local checks only: no deployment, migration or production account operations.
const root = fileURLToPath(new URL('../../', import.meta.url));
const bin = (name) => path.join(root, 'node_modules', '.bin', name);
const checks = [
  ['Testes de bibliotecas e componentes', bin('vitest'), ['run', 'src/lib', 'src/components']],
  ['TypeScript operacional', bin('tsc'), ['--noEmit', '-p', 'tsconfig.app.json']],
  ['Build isolado Supabase', bin('vite'), ['build', '--config', 'vite.access.config.ts']],
];
if (checks.some(([, command]) => !existsSync(command))) {
  console.error('Dependências ausentes. Execute pnpm install --frozen-lockfile antes da verificação.');
  process.exit(1);
}
for (const [label, command, args] of checks) {
  console.log('\n' + label);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) {
    console.error('Verificação interrompida: ' + label + '. Não considerar o candidato aprovado.');
    process.exit(1);
  }
}
console.log('\nVerificações locais aprovadas. NÃO autoriza publicação: faltam os aceites autenticados, privacidade, recuperação e integrações expostas.');
