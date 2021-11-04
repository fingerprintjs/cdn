import * as path from 'path'
import { promises as fs } from 'fs'
import { CloudFrontRequestHandler, CloudFrontResultResponse } from 'aws-lambda'
import {
  makeCacheHeaders,
  makeCorsHeaders,
  notFoundStatus,
  okStatus,
  permanentRedirectStatus,
  temporaryRedirectStatus,
} from './utils/http'
import { makeRequestUri, parseRequestUri, UriDataExactVersion, UriDataVagueVersion } from './router'
import { downloadPackage, ErrorName as NpmError, getPackageGreatestVersion } from './npm'
import { intersectVersionRanges } from './utils/version'

/**
 * The entrypoint of the lambda function
 */
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
    return makeNotFoundResponse(`The ${request.uri} path doesn't exist`)
  }

  // TypeScript doesn't guards the type if `uriData.version.requestedType === 'vague'` is used
  const { version } = uriData
  if (version.requestedType === 'vague') {
    return await handleVagueNpmVersion({ ...uriData, version })
  }
  return await handleExactNpmVersion({ ...uriData, version })
}

async function handleVagueNpmVersion({
  project,
  version,
  route,
}: UriDataVagueVersion): Promise<CloudFrontResultResponse> {
  let exactVersion: string

  try {
    exactVersion = await getPackageGreatestVersion(
      version.npmPackage,
      intersectVersionRanges(version.versionRange, version.requestedRange),
      true,
    )
  } catch (error) {
    if (error instanceof Error && error.name === NpmError.NpmNotFound) {
      return makeNotFoundResponse(`There is no version matching ${version.requestedRange.start}.*`)
    }
    throw error
  }

  const redirectUri = makeRequestUri(project.key, exactVersion, route.type === 'redirect' ? route.target : route.path)
  return {
    ...temporaryRedirectStatus,
    headers: {
      ...makeCorsHeaders(),
      ...makeCacheHeaders(tempRedirectBrowserCacheDuration, tempRedirectCdnCacheDuration),
      location: [{ value: redirectUri }],
    },
  }
}

async function handleExactNpmVersion({
  project,
  version,
  route,
}: UriDataExactVersion): Promise<CloudFrontResultResponse> {
  if (route.type === 'redirect') {
    const redirectUri = makeRequestUri(project.key, version.requestedVersion, route.target)
    return {
      ...permanentRedirectStatus,
      headers: {
        ...makeCorsHeaders(),
        ...makeCacheHeaders(immutableCacheDuration),
        location: [{ value: redirectUri }],
      },
    }
  }

  let mainScript: string

  try {
    mainScript = await getPackageMainScript(version.npmPackage, version.requestedVersion)
  } catch (error) {
    if (error instanceof Error && error.name === NpmError.NpmNotFound) {
      return makeNotFoundResponse(`There is no version ${version.requestedVersion}`)
    }
    throw error
  }

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
  const packageJsonContent = await fs.readFile(path.join(packageDirectory, 'package.json'), 'utf8')
  const packageDescription = JSON.parse(packageJsonContent)

  for (const relativePath of [packageDescription.module, packageDescription.main]) {
    if (typeof relativePath !== 'string') {
      continue
    }
    const fullPath = path.join(packageDirectory, ...relativePath.split('/'))
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

function makeNotFoundResponse(message: string): CloudFrontResultResponse {
  return {
    ...notFoundStatus,
    headers: {
      ...makeCorsHeaders(),
      ...makeCacheHeaders(notFoundBrowserCacheDuration, notFoundCdnCacheDuration),
    },
    body: message,
  }
}

const oneHour = 60 * 60 * 1000
const oneDay = oneHour * 24
const oneYear = oneDay * 365
const immutableCacheDuration = oneYear
const notFoundBrowserCacheDuration = oneDay
const notFoundCdnCacheDuration = oneHour
const tempRedirectBrowserCacheDuration = notFoundBrowserCacheDuration
const tempRedirectCdnCacheDuration = notFoundCdnCacheDuration
