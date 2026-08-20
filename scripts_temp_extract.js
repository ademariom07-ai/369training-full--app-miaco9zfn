import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

// Minimal unzip parser for docx (ZIP format)
function extractZip(buffer) {
  const files = {}
  let offset = 0

  // Search for local file headers (0x04034b50)
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) === 0x04034b50) {
      const compressionMethod = buffer.readUInt16LE(offset + 8)
      const compressedSize = buffer.readUInt32LE(offset + 18)
      const uncompressedSize = buffer.readUInt32LE(offset + 22)
      const fileNameLength = buffer.readUInt16LE(offset + 26)
      const extraFieldLength = buffer.readUInt16LE(offset + 28)

      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLength)
      const dataOffset = offset + 30 + fileNameLength + extraFieldLength
      const compressedData = buffer.slice(dataOffset, dataOffset + compressedSize)

      let uncompressedData
      if (compressionMethod === 0) {
        uncompressedData = compressedData
      } else if (compressionMethod === 8) {
        uncompressedData = zlib.inflateRawSync(compressedData)
      } else {
        console.log(`Unknown compression method ${compressionMethod} for ${fileName}`)
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

const docxPath = path.resolve('src/assets/logo-oficial-1d053.docx')
console.log('Reading:', docxPath)
const buffer = fs.readFileSync(docxPath)
const files = extractZip(buffer)
console.log('Files in docx:', Object.keys(files))

for (const [name, data] of Object.entries(files)) {
  if (name.startsWith('word/media/')) {
    console.log(`Found media: ${name}, size: ${data.length} bytes`)
    const outputPath = path.resolve('src/assets/logo-oficial.png')
    fs.writeFileSync(outputPath, data)
    console.log(`Saved to ${outputPath}`)
  }
}
