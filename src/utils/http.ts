import * as crypto from 'crypto'
import { CloudFrontHeaders, CloudFrontRequestEvent, CloudFrontResultResponse, Context } from 'aws-lambda'

type Status = Pick<CloudFrontResultResponse, 'status' | 'statusDescription'>

type AsyncCloudFrontHandler = (event: CloudFrontRequestEvent, context: Context) => Promise<CloudFrontResultResponse>

export const okStatus: Status = {
  status: '200',
}

export const permanentRedirectStatus: Status = {
  status: '301',
  statusDescription: 'Moved Permanently',
}

export const temporaryRedirectStatus: Status = {
  status: '302',
  statusDescription: 'Found',
}

export const notFoundStatus: Status = {
  status: '404',
  statusDescription: 'Not Found',
}

/**
 * A common HTTP middleware that applies the best CDN practices
 */
export function withBestPractices(next: AsyncCloudFrontHandler): AsyncCloudFrontHandler {
  return async (event, context) => {
    const response = await next(event, context)
    const headers = addMissingHeaders(
      response.headers,
      {
        'access-control-allow-origin': [{ value: '*' }],
        'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
      },
      (!!response.body || !['201', '204', '301', '302', '303', '307', '308'].includes(response.status)) && {
        'content-type': [{ value: 'text/plain; charset=utf-8' }],
        'x-content-type-options': [{ value: 'nosniff' }],
      },
    )
    if (response.status === '200' && response.body && !headers.etag?.length) {
      headers.etag = [{ value: `"${getBodyHash(response.body)}"` }]
    }
    return { ...response, headers }
  }
}

/**
 * Note: the times are durations in milliseconds
 */
export function makeCacheControlHeaders(
  browserCacheTime: number,
  cdnCacheDuration = browserCacheTime,
  durationFluctuation = 0.1,
): CloudFrontHeaders {
  const headers: CloudFrontHeaders = {}
  const fluctuationMultiplier = 1 - durationFluctuation / 2 + durationFluctuation * Math.random()

  const cacheControl = ['public', `max-age=${((browserCacheTime / 1000) * fluctuationMultiplier).toFixed()}`]
  if (browserCacheTime !== cdnCacheDuration) {
    cacheControl.push(`s-maxage=${applyFluctuation(cdnCacheDuration / 1000, durationFluctuation).toFixed()}`)
  }
  headers['cache-control'] = [{ value: cacheControl.join(', ') }]

  return headers
}

export function getBodyHash(body: string): string {
  // SHA1 is the fastest built-in hash. It takes about 1ms to hash 100KB on a 1-core Lambda@Edge.
  // When the SHA1 algorithm is used, the last symbol is always `=` that can be removed.
  return crypto.createHash('sha1').update(body).digest('base64').slice(0, -1)
}

function applyFluctuation(value: number, fluctuation: number): number {
  return value * (1 - fluctuation / 2 + fluctuation * Math.random())
}

/**
 * Note: in contrast to Object.assign and object spread, the early headers have a higher priority
 */
function addMissingHeaders(...headerSets: (CloudFrontHeaders | false | null | undefined)[]): CloudFrontHeaders {
  const result = { ...headerSets[0] }
  for (let i = 1; i < headerSets.length; ++i) {
    const headers = headerSets[i]
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        if (!result[name]?.length) {
          result[name] = value
        }
      }
    }
  }
  return result
}
