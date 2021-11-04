import * as path from 'path'
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
import buildBundle from './bundler'

const oneHour = 60 * 60 * 1000
const oneDay = oneHour * 24
const oneYear = oneDay * 365
const immutableCacheTime = oneYear
const notFoundBrowserCacheTime = oneDay
const notFoundCdnCacheTime = oneHour
const tempRedirectBrowserCacheTime = oneDay * 7
const tempRedirectCdnCacheTime = oneHour
const monitoringBrowserCacheTime = tempRedirectBrowserCacheTime
const monitoringCdnCacheTime = oneYear

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
        ...makeCacheHeaders(immutableCacheTime),
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
      ...makeCacheHeaders(tempRedirectBrowserCacheTime, tempRedirectCdnCacheTime),
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
        ...makeCacheHeaders(immutableCacheTime),
        location: [{ value: redirectUri }],
      },
    }
  }

  if (route.type === 'monitoring') {
    return {
      ...permanentRedirectStatus,
      headers: {
        ...makeCorsHeaders(),
        ...makeCacheHeaders(monitoringBrowserCacheTime, monitoringCdnCacheTime),
      },
    }
  }

  let packageDirectory: string

  try {
    packageDirectory = await downloadPackage(version.npmPackage, version.requestedVersion)
  } catch (error) {
    if (error instanceof Error && error.name === NpmError.NpmNotFound) {
      return makeNotFoundResponse(`There is no version ${version.requestedVersion}`)
    }
    throw error
  }

  const code = await buildBundle({
    packageDirectory,
    nodeModulesDirectory: path.join(__dirname, '..', 'node_modules'),
    format: route.format,
    globalVariableName: route.globalVariableName,
    minify: route.minified,
  })

  return {
    ...okStatus,
    headers: {
      ...makeCorsHeaders(),
      ...makeCacheHeaders(immutableCacheTime),
      'content-type': [{ value: 'application/javascript; charset=utf-8' }],
    },
    body: code,
  }
}

function makeNotFoundResponse(message: string): CloudFrontResultResponse {
  return {
    ...notFoundStatus,
    headers: {
      ...makeCorsHeaders(),
      ...makeCacheHeaders(notFoundBrowserCacheTime, notFoundCdnCacheTime),
    },
    body: message,
  }
}
