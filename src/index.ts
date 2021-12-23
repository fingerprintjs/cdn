import { CloudFrontRequestEvent, CloudFrontRequestHandler, CloudFrontResultResponse } from 'aws-lambda'
import * as httpUtil from './utils/http'
import { makeRequestUri, parseRequestUri, UriDataExactVersion, UriDataInexactVersion } from './router'
import { downloadPackage, ErrorName as NpmError, getPackageGreatestVersion } from './npm'
import { intersectVersionRanges } from './utils/version'

const oneMinute = 60 * 1000
const oneHour = oneMinute * 60
const oneDay = oneHour * 24
const oneYear = oneDay * 365
const immutableCacheTime = oneYear
// The not found time should be small to help in the following case:
// 1. Somebody requests an exact version that doesn't exists, CloudFront caches the 404 response;
// 2. The exact version is published and the inexact endpoint redirects to it.
const notFoundBrowserCacheTime = oneHour
const tempNotFoundCdnCacheTime = oneMinute * 5
const tempRedirectBrowserCacheTime = oneDay * 7
const tempRedirectCdnCacheTime = oneHour
const monitoringBrowserCacheTime = tempRedirectBrowserCacheTime
const monitoringCdnCacheTime = immutableCacheTime

/**
 * The entrypoint of the lambda function.
 * The function throws unexpected errors instead of making an error page in order for AWS to record the errors.
 */
export const handler: CloudFrontRequestHandler = httpUtil.withBestPractices(async (event) => {
  logEvent(event)

  const request = event.Records[0].cf.request
  if (request.uri === '/') {
    return {
      ...httpUtil.okStatus,
      headers: httpUtil.makeCacheHeaders(immutableCacheTime),
      body: 'This is a FingerprintJS CDN',
    }
  }

  const uriData = parseRequestUri(request.uri)
  if (!uriData) {
    return makeNotFoundResponse(`The ${request.uri} path doesn't exist`, true)
  }

  // TypeScript doesn't guard the type if `uriData.version.requestedType === 'inexact'` is used
  const { version } = uriData
  if (version.requestedType === 'inexact') {
    return await handleInexactProjectVersion({ ...uriData, version })
  }
  return await handleExactProjectVersion({ ...uriData, version })
})

async function handleInexactProjectVersion({
  project,
  version,
  route,
}: UriDataInexactVersion): Promise<CloudFrontResultResponse> {
  const exactVersion = await getPackageGreatestVersion(
    version.npmPackage,
    intersectVersionRanges(version.versionRange, version.requestedRange),
    version.excludeVersions,
    true,
  )

  if (exactVersion === undefined) {
    return makeNotFoundResponse(`There is no version matching ${version.requestedRange.start}.*`, false)
  }

  // If the route is a redirect, follow that redirect to make browser do 1 redirect instead of 2
  const redirectUri = makeRequestUri(project.key, exactVersion, route.type === 'redirect' ? route.target : route.path)
  return makeRedirectResponse(redirectUri, false)
}

async function handleExactProjectVersion({
  project,
  version,
  route,
}: UriDataExactVersion): Promise<CloudFrontResultResponse> {
  if (route.type === 'redirect') {
    const redirectUri = makeRequestUri(project.key, version.requestedVersion, route.target)
    return makeRedirectResponse(redirectUri, true)
  }

  if (route.type === 'monitoring') {
    return {
      ...httpUtil.okStatus,
      headers: httpUtil.makeCacheHeaders(monitoringBrowserCacheTime, monitoringCdnCacheTime),
    }
  }

  const [packageDirectory, buildBundle] = await Promise.all([
    downloadPackage(version.npmPackage, version.requestedVersion).catch((error) => {
      if (isNpmNotFoundError(error)) {
        return makeNotFoundResponse(`There is no version ${version.requestedVersion}`, false)
      }
      throw error
    }),

    // This file imports Rollup, it takes some time. If was imported using the `import from` syntax, Rollup would be
    // loaded on every request, and the time would be wasted. The dynamic import loads the code only when it's required
    // and in parallel with other processes.
    import('./bundler').then((module) => module.default),
  ])

  if (typeof packageDirectory === 'object') {
    return packageDirectory
  }

  const code = await buildBundle({
    packageDirectory,
    nodeModules: ['tslib'],
    format: route.format,
    globalVariableName: route.globalVariableName,
    minify: route.minified,
    replacements: route.replacements,
  })

  return {
    ...httpUtil.okStatus,
    headers: {
      ...httpUtil.makeCacheHeaders(immutableCacheTime),
      'content-type': [{ value: 'text/javascript; charset=utf-8' }],
    },
    body: code,
  }
}

function makeRedirectResponse(uri: string, isPermanent: boolean): CloudFrontResultResponse {
  return {
    ...(isPermanent ? httpUtil.permanentRedirectStatus : httpUtil.temporaryRedirectStatus),
    headers: {
      ...httpUtil.makeCacheHeaders(
        isPermanent ? immutableCacheTime : tempRedirectBrowserCacheTime,
        isPermanent ? immutableCacheTime : tempRedirectCdnCacheTime,
      ),
      location: [{ value: uri }],
    },
  }
}

/**
 * Set `isPermanent` to true if the resource can not appear later by itself,
 * i.e. if the resource can appear only after changing the lambda code.
 */
function makeNotFoundResponse(message: string, isPermanent: boolean): CloudFrontResultResponse {
  return {
    ...httpUtil.notFoundStatus,
    headers: httpUtil.makeCacheHeaders(
      notFoundBrowserCacheTime,
      isPermanent ? immutableCacheTime : tempNotFoundCdnCacheTime,
    ),
    body: message,
  }
}

function isNpmNotFoundError(error: unknown) {
  return error instanceof Error && [NpmError.NpmNotFound, NpmError.InvalidVersionName].includes(error.name as NpmError)
}

/**
 * Logs the event data to know what the request URI was in case of an unexpected error
 */
function logEvent(event: CloudFrontRequestEvent) {
  // Remove the unnecessary data to reduce the log size
  const data = event.Records.map((record) => ({
    ...record.cf,
    request: { ...record.cf.request, headers: '(omitted)', origin: '(omitted)' },
  }))

  // Lambda writes the console output to CloudWatch
  // eslint-disable-next-line no-console
  console.log(`CloudFront event: ${JSON.stringify(data, null, 2)}`)
}
