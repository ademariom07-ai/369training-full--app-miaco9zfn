// Script para download e validação dos 4 ícones PNG do PWA em public/icons/
// 1. icon-192.png (192x192)
// 2. icon-512.png (512x512)
// 3. maskable-512.png (512x512 maskable)
// 4. apple-touch-icon.png (180x180)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const iconsDir = path.resolve(projectRoot, 'public/icons')

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const ICONS = ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png']

export function verifyIcons() {
  console.log('[download-icons] Verificando arquivos em public/icons/ ...')
  let allValid = true

  for (const icon of ICONS) {
    const fullPath = path.join(iconsDir, icon)
    if (!fs.existsSync(fullPath)) {
      console.error(`[download-icons] ERRO: Arquivo não encontrado: ${icon}`)
      allValid = false
      continue
    }

    const stats = fs.statSync(fullPath)
    if (stats.size === 0) {
      console.error(`[download-icons] ERRO: Arquivo vazio: ${icon}`)
      allValid = false
      continue
    }

    const buffer = fs.readFileSync(fullPath)
    const hasPngHeader = buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)
    if (!hasPngHeader) {
      console.error(`[download-icons] ERRO: Assinatura PNG inválida em ${icon}`)
      allValid = false
      continue
    }

    console.log(`[download-icons] OK: ${icon} (${stats.size} bytes, cabeçalho PNG válido)`)
  }

  return allValid
}

if (!verifyIcons()) {
  process.exit(1)
}
console.log('[download-icons] Todos os 4 ícones PWA estão presentes e válidos.')
