import { promisify } from 'util'
import * as stream from 'stream'
import * as zlib from 'zlib'
import * as path from 'path'
import { compareVersions, isStableVersion, isSemVerVersion, isVersionInRange, VersionRange } from './utils/version'
import { makeTemporaryDirectory } from './utils/filesystem'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const validateNpmName = require('validate-npm-package-name')

/**
 * Expected errors
 */
export const enum ErrorName {
  /** The package or its version don't exist on the NPM registry */
  NpmNotFound = 'NpmNotFound',
  /** The package name is not a valid package name */
  InvalidPackageName = 'InvalidPackageName',
  /** The package version is not a valid version string */
  InvalidVersionName = 'InvalidVersionName',
}

/**
 * NPM registry response with a short information about a package
 *
 * @see https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md
 */
export interface RegistryPackageShortData {
  name: string
  'dist-tags': Record<string, string>
  /** The versions go in order of publishing, not in version order */
  versions: Record<
    string,
    {
      name: string
      version: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      dist: {
        shasum: string
        integrity?: string
        tarball: string
        fileCount?: number
        unpackedSize?: number
        'npm-signature'?: string
      }
      deprecated?: string
    }
  >
  modified: string
}

const registryUrl = 'https://registry.npmjs.org'

/**
 * The keys are the package names and versions separated by `@`.
 * The values are downloading promises that resolve with the path to the directory with the extracted packages.
 *
 * The packages that may already been downloading before running this code are ignored because they can be corrupt.
 *
 * 512MB of temporary storage available for AWS lambdas should be enough for everything, so we don't clear the cache.
 */
const packageDownloads = new Map<string, Promise<string>>()

/**
 * Fetches the number of the latest package version from an NPM registry
 */
export async function getPackageGreatestVersion(
  name: string,
  versionRange?: VersionRange,
  exclude?: string[],
  onlyStable?: boolean,
): Promise<string> {
  // The dynamic importing is used to reduce the initialization time when the library isn't required
  const { default: got } = await import('got')
  let packageInformation: RegistryPackageShortData

  try {
    // todo: Cache the response for a short time
    packageInformation = await got
      .get(getPackageInformationUrl(name), {
        headers: {
          Accept: 'application/vnd.npm.install-v1+json', // Makes the registry return only the necessary data
        },
      })
      .json()
  } catch (error) {
    if (error instanceof got.HTTPError && error.response.statusCode === 404) {
      throw createError(ErrorName.NpmNotFound, `The package ${name} doesn't exist on NPM`)
    }
    throw error
  }

  const greatestVersion = findGreatestVersion(
    Object.keys(packageInformation.versions),
    versionRange,
    exclude,
    onlyStable,
  )
  if (greatestVersion !== undefined) {
    return greatestVersion
  }

  throw createError(
    ErrorName.NpmNotFound,
    versionRange?.start || versionRange?.end
      ? 'No version of the NPM package matches ' +
          [versionRange?.start && `≥${versionRange.start}`, versionRange?.end && `<${versionRange.end}`]
            .filter(Boolean)
            .join(' and ')
      : 'The NPM package has no versions',
  )
}

/**
 * Downloads the NPM package and returns the directory location of the extracted package files
 */
export function downloadPackage(name: string, version: string): Promise<string> {
  const cacheKey = `${name}@${version}`
  let downloadPromise = packageDownloads.get(cacheKey)

  if (!downloadPromise) {
    downloadPromise = downloadPackageRegardless(name, version).catch((error) => {
      packageDownloads.delete(cacheKey)
      throw error
    })
    packageDownloads.set(cacheKey, downloadPromise)
  }

  return downloadPromise
}

/**
 * Downloads the NPM package despite the cache and returns the directory location of the extracted package files
 */
async function downloadPackageRegardless(name: string, version: string): Promise<string> {
  // todo: Try to store the unpacked packages in the memory instead of the disk
  // The dynamic importing is used to reduce the initialization time when the libraries aren't required
  const [{ default: got }, tar] = await Promise.all([import('got'), import('tar-fs')])

  const directory = await makeTemporaryDirectory()

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
      throw createError(ErrorName.NpmNotFound, `The package ${name} or its version ${version} don't exist on NPM`)
    }
    throw error
  }

  // NPM packages always have a root directory called "package"
  return path.join(directory, 'package')
}

function findGreatestVersion(
  versions: string[],
  versionRange?: VersionRange,
  exclude?: string[],
  onlyStable?: boolean,
): string | undefined {
  let greatestVersionIndex: number | undefined

  // The versions go in order of publishing, not in version order, so we should check all to find the greatest
  for (let i = versions.length - 1; i >= 0; --i) {
    // But we check only 20 after the greatest suitable version to improve the performance
    if (greatestVersionIndex !== undefined && greatestVersionIndex - i > 20) {
      break
    }

    if (
      (!onlyStable || isStableVersion(versions[i])) &&
      (!versionRange || isVersionInRange(versionRange, versions[i])) &&
      !exclude?.includes(versions[i])
    ) {
      if (greatestVersionIndex === undefined || compareVersions(versions[greatestVersionIndex], versions[i]) < 0) {
        greatestVersionIndex = i
      }
    }
  }

  return greatestVersionIndex === undefined ? undefined : versions[greatestVersionIndex]
}

function getPackageInformationUrl(name: string) {
  const nameCheck = validateNpmName(name)
  if (!nameCheck.validForOldPackages) {
    throw createError(ErrorName.InvalidPackageName, nameCheck.errors.join(', '))
  }

  // A proper package name is a URL-friendly string, so it's safe to insert it into the URL directly
  return `${registryUrl}/${name}`
}

function getPackageTarballUrl(name: string, version: string) {
  if (!isSemVerVersion(version)) {
    throw createError(ErrorName.InvalidVersionName)
  }

  // The package name is URL-friendly (otherwise `getPackageInformationUrl` throws an error), so it's safe to insert
  // `scopelessName` into the URL directly. The valid SemVer version is URL-friendly too.
  const scopelessName = name.startsWith('@') ? name.split('/', 2)[1] : name
  return `${getPackageInformationUrl(name)}/-/${scopelessName}-${version}.tgz`
}

function createError(name: string, message = name) {
  const error = new Error(message)
  error.name = name
  return error
}
