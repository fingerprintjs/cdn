import * as stream from 'stream'
import * as zlib from 'zlib'
import * as os from 'os'
import * as path from 'path'
import { promises as fs } from 'fs'
import { promisify } from 'util'
import { CloudFrontRequestHandler } from 'aws-lambda'
import got from 'got'
import * as tar from 'tar-fs'
import { makeCacheHeaders, makeCorsHeaders, notFoundStatus, okStatus } from './utils/http'
import { parseRequestUri } from './router'

export const handler: CloudFrontRequestHandler = async (event) => {
  const request = event.Records[0].cf.request

  if (request.uri === '/') {
    return {
      ...okStatus,
      headers: {
        ...makeCorsHeaders(),
        ...makeCacheHeaders(immutableCacheDuration),
      },
      body: 'Hello, have a nice day',
    }
  }

  const uriData = parseRequestUri(request.uri)
  if (!uriData) {
    return {
      ...notFoundStatus,
      headers: {
        ...makeCorsHeaders(),
        ...makeCacheHeaders(notFoundBrowserCacheDuration, notFoundCdnCacheDuration),
      },
      body: `The ${request.uri} path doesn't exist`,
    }
  }

  if (uriData.version.requestedType === 'vague') {
    // todo: Implement the vague version redirect
    return {
      status: '501',
      statusDescription: 'Not Implemented',
      headers: makeCorsHeaders(),
      body: 'Coming coon...',
    }
  }

  // todo: Return 404 when the given package is not found
  const mainScript = await getPackageMainScript(uriData.project.npmName, uriData.version.requestedVersion)
  return {
    ...okStatus,
    headers: {
      ...makeCorsHeaders(),
      ...makeCacheHeaders(immutableCacheDuration),
      'content-type': [{ value: 'application/javascript; charset=utf-8' }],
    },
    body: mainScript,
  }
}

async function getPackageMainScript(name: string, version: string): Promise<string> {
  const packageDirectory = await downloadPackage(name, version)
  const packageJsonContent = await fs.readFile(path.join(packageDirectory, 'package', 'package.json'), 'utf8')
  const packageDescription = JSON.parse(packageJsonContent)

  for (const relativePath of [packageDescription.module, packageDescription.main]) {
    const fullPath = path.join(packageDirectory, 'package', ...relativePath.split('/'))
    try {
      return await fs.readFile(fullPath, 'utf8')
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT' || // Means that the file doesn't exist
        (error as NodeJS.ErrnoException).code === 'EISDIR' // Means that the path is a directory
      ) {
        continue
      }
      throw error
    }
  }

  throw new Error('The package has no main file')
}

async function downloadPackage(name: string, version: string) {
  // todo: Don't download if already downloaded
  // todo: Handle downloading errors
  const directory = getPackageDirectory(name, version)

  await promisify(stream.pipeline)(
    got.stream(getPackageUrl(name, version)),
    zlib.createGunzip(),
    tar.extract(directory, {
      strict: false,
      readable: true,
      writable: true,
      ignore: (_, header) => !(header?.type === 'file' || header?.type === 'directory'),
    }),
  )

  return directory
}

function getPackageUrl(name: string, version: string, registryUrl = 'https://registry.npmjs.org') {
  const scopelessName = name.startsWith('@') ? name.split('/', 2)[1] : name
  return `${registryUrl}/${name}/-/${scopelessName}-${version}.tgz`
}

function getPackageDirectory(name: string, version: string): string {
  return path.join(os.tmpdir(), 'npm', ...name.split('/'), `@${version}`)
}

const oneHour = 60 * 60 * 1000
const oneDay = oneHour * 24
const oneYear = oneDay * 365
const immutableCacheDuration = oneYear
const notFoundBrowserCacheDuration = oneDay
const notFoundCdnCacheDuration = oneHour
