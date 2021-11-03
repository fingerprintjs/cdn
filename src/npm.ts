import { promisify } from 'util'
import * as stream from 'stream'
import * as zlib from 'zlib'
import * as path from 'path'
import * as os from 'os'
import got from 'got'
import * as tar from 'tar-fs'

/**
 * Expected errors
 */
export const enum ErrorName {
  /** The package or its version don't exist on NPM */
  NpmNotFound = 'npmNotFound',
}

/**
 * Downloads the NPM package and returns the directory location of the extracted package files
 */
export async function downloadPackage(name: string, version: string): Promise<string> {
  // todo: Don't download if already downloaded
  // todo: Handle downloading errors
  const directory = getPackageDirectory(name, version)

  try {
    await promisify(stream.pipeline)(
      got.stream(getPackageUrl(name, version), { retry: 3, timeout: 10000 }),
      zlib.createGunzip(),
      tar.extract(directory, {
        strict: false,
        readable: true,
        writable: true,
        ignore: (_, header) => !(header?.type === 'file' || header?.type === 'directory'),
      }),
    )
  } catch (error) {
    if (error instanceof got.HTTPError && error.response.statusCode === 404) {
      const error = new Error(`The package ${name} or its version ${version} don't exist on NPM`)
      error.name = ErrorName.NpmNotFound
      throw error
    }
    throw error
  }

  // NPM packages always have a root directory called "package"
  return path.join(directory, 'package')
}

function getPackageUrl(name: string, version: string, registryUrl = 'https://registry.npmjs.org') {
  const scopelessName = name.startsWith('@') ? name.split('/', 2)[1] : name
  return `${registryUrl}/${name}/-/${scopelessName}-${version}.tgz`
}

function getPackageDirectory(name: string, version: string): string {
  return path.join(os.tmpdir(), 'npm', ...name.split('/'), `@${version}`)
}
