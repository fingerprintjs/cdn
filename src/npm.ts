import { promisify } from 'util'
import * as stream from 'stream'
import * as zlib from 'zlib'
import * as path from 'path'
import * as os from 'os'
import got from 'got'
import * as tar from 'tar-fs'
import { compareVersions, doesVersionMatch, isVersionInRange } from './utils/version'

/**
 * Expected errors
 */
export const enum ErrorName {
  /** The package or its version don't exist on NPM */
  NpmNotFound = 'npmNotFound',
}

/**
 * NPM registry response with a short information about a package
 *
 * @see https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md
 */
interface RegistryPackageShortData {
  name: string
  'dist-tags': Record<string, string>
  /** The versions go in order of publishing, not in version order */
  versions: Record<
    string,
    {
      name: string
      version: string
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
      dist: {
        shasum: string
        integrity?: string
        tarball: string
        fileCount?: number
        unpackedSize?: number
        'npm-signature'?: string
      }
    }
  >
  modified: string
}

const registryUrl = 'https://registry.npmjs.org'

export async function getPackageGreatestVersion(
  name: string,
  startVersion?: string,
  endVersion?: string,
  expectedVersion?: string,
): Promise<string> {
  let packageInformation: RegistryPackageShortData

  try {
    packageInformation = await got
      .get(getPackageInformationUrl(name), {
        headers: {
          Accept: 'application/vnd.npm.install-v1+json', // Names the registry return only the necessary data
        },
      })
      .json()
  } catch (error) {
    if (error instanceof got.HTTPError && error.response.statusCode === 404) {
      const error = new Error(`The package ${name} doesn't exist on NPM`)
      error.name = ErrorName.NpmNotFound
      throw error
    }
    throw error
  }

  const greatestVersion = findGreatestVersion(
    Object.keys(packageInformation.versions),
    startVersion,
    endVersion,
    expectedVersion,
  )
  if (greatestVersion !== undefined) {
    return greatestVersion
  }

  const error = new Error(`No version of the NPM package matches ${expectedVersion}`)
  error.name = ErrorName.NpmNotFound
  throw error
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
      got.stream(getPackageTarballUrl(name, version), { retry: 3, timeout: 10000 }),
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

function findGreatestVersion(
  versions: string[],
  startVersion?: string,
  endVersion?: string,
  expectedVersion?: string,
): string | undefined {
  let greatestVersionIndex: number | undefined

  // The versions go in order of publishing, not in version order, so we should check all to find the greatest
  for (let i = versions.length - 1; i >= 0; --i) {
    // But we check only 20 after the greatest suitable version to improve the performance
    if (greatestVersionIndex !== undefined && greatestVersionIndex - i > 20) {
      break
    }

    if (
      isVersionInRange(startVersion, versions[i], endVersion) &&
      (expectedVersion === undefined || doesVersionMatch(expectedVersion, versions[i]))
    ) {
      if (greatestVersionIndex === undefined || compareVersions(versions[greatestVersionIndex], versions[i]) < 0) {
        greatestVersionIndex = i
      }
    }
  }

  return greatestVersionIndex === undefined ? undefined : versions[greatestVersionIndex]
}

function getPackageInformationUrl(name: string) {
  return `${registryUrl}/${name}`
}

function getPackageTarballUrl(name: string, version: string) {
  const scopelessName = name.startsWith('@') ? name.split('/', 2)[1] : name
  return `${registryUrl}/${name}/-/${scopelessName}-${version}.tgz`
}

function getPackageDirectory(name: string, version: string): string {
  return path.join(os.tmpdir(), 'npm', ...name.split('/'), `@${version}`)
}
