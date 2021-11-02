import * as stream from 'node:stream'
import * as zlib from 'node:zlib'
import { promisify } from 'node:util'
import { CloudFrontRequestHandler } from 'aws-lambda'
import got from 'got'
import * as tar from 'tar-stream'

export const handler: CloudFrontRequestHandler = async () => {
  const packageContent = await downloadPackage(
    'https://registry.npmjs.org/@fingerprintjs/fingerprintjs/-/fingerprintjs-3.3.0.tgz',
  )

  const contentObject: Record<string, string> = {}
  for (const [key, value] of packageContent.entries()) {
    contentObject[key] = value
  }

  const now = new Date()
  return {
    status: '200',
    headers: {
      'content-type': [{ value: 'application/json; charset=utf-8' }],
      'cache-control': [{ value: 'public, max-age=31536000' }],
      'last-modified': [{ value: now.toUTCString() }],
    },
    body: JSON.stringify(contentObject, null, 2),
  }
}

async function downloadPackage(packageUrl: string) {
  const files = new Map<string, string>()
  const extractor = tar.extract()

  // Example of file handling: https://github.com/mafintosh/tar-fs/blob/master/index.js
  extractor.on('entry', (header, stream, next) => {
    if (header.type !== 'file' || !(header.name === 'package/package.json' || /\.m?js$/i.test(header.name))) {
      stream.resume()
      return next()
    }

    let fileContent = ''
    stream.on('data', (chunk) => {
      fileContent += chunk
    })
    stream.on('error', next)
    stream.on('end', () => {
      files.set(header.name, fileContent)
      next()
    })
    stream.resume()
  })

  await promisify(stream.pipeline)(got.stream(packageUrl), zlib.createGunzip(), extractor)

  return files
}
