import * as path from 'path'
import * as os from 'os'
import { createReadStream, promises as fs } from 'fs'

export function makeTemporaryDirectory(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'fpjs-'))
}

export async function readFirstCharacters(filePath: string, maxLength: number): Promise<string> {
  let fileContent = ''
  const readStream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: maxLength })

  try {
    await new Promise<void>((resolve, reject) => {
      readStream.on('data', (chunk) => {
        fileContent += chunk
        if (fileContent.length >= maxLength) {
          fileContent = fileContent.slice(0, maxLength)
          resolve()
        }
      })
      readStream.on('error', reject)
      readStream.on('end', resolve)
    })
  } finally {
    readStream.close()
  }

  return fileContent
}
