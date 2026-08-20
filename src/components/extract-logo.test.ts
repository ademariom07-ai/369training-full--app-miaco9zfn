import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

function extractZip(buffer: Buffer) {
  const files: Record<string, Buffer> = {}
  let offset = 0

  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) === 0x04034b50) {
      const compressionMethod = buffer.readUInt16LE(offset + 8)
      const compressedSize = buffer.readUInt32LE(offset + 18)
      const fileNameLength = buffer.readUInt16LE(offset + 26)
      const extraFieldLength = buffer.readUInt16LE(offset + 28)

      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLength)
      const dataOffset = offset + 30 + fileNameLength + extraFieldLength
      const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize)

      let uncompressedData: Buffer | undefined
      if (compressionMethod === 0) {
        uncompressedData = compressedData
      } else if (compressionMethod === 8) {
        uncompressedData = zlib.inflateRawSync(compressedData)
      }

      if (uncompressedData) {
        files[fileName] = uncompressedData
      }

      offset = dataOffset + compressedSize
    } else {
      offset++
    }
  }
  return files
}

describe('Extract Logo from docx', () => {
  it('extracts image from docx and writes logo-oficial.png', () => {
    const docxPath = path.resolve(process.cwd(), 'src/assets/logo-oficial-1d053.docx')
    expect(fs.existsSync(docxPath)).toBe(true)
    const buffer = fs.readFileSync(docxPath)
    const files = extractZip(buffer)

    console.log('Files found in docx:', Object.keys(files))

    let found = false
    for (const [name, data] of Object.entries(files)) {
      if (name.startsWith('word/media/')) {
        const outPath = path.resolve(process.cwd(), 'src/assets/logo-oficial.png')
        fs.writeFileSync(outPath, data)
        // Also write base64 dump so we can inspect it or keep it reliable
        const base64 = data.toString('base64')
        fs.writeFileSync(path.resolve(process.cwd(), 'src/assets/logo-base64.txt'), base64)
        found = true
      }
    }
    expect(found).toBe(true)
  })
})
