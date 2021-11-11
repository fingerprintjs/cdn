import { CloudFrontHeaders, CloudFrontRequestEvent, CloudFrontResultResponse } from 'aws-lambda'

type Status = Pick<CloudFrontResultResponse, 'status' | 'statusDescription'>

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
 * A common HTTP middleware that applies best CDN practices
 */
export function withBestPractices(
  next: (event: CloudFrontRequestEvent) => Promise<CloudFrontResultResponse> | CloudFrontResultResponse,
): (event: CloudFrontRequestEvent) => Promise<CloudFrontResultResponse> {
  return async (event) => {
    const response = await next(event)
    return {
      ...response,
      headers: mergeHeaders(
        response.headers,
        {
          'access-control-allow-origin': [{ value: '*' }],
          'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
        },
        !/^3\d\d$/.test(response.status) && {
          'content-type': [{ value: 'text/plain; charset=UTF-8' }],
          'x-content-type-options': [{ value: 'nosniff' }],
        },
      ),
    }
  }
}

/**
 * Note: the times are durations in milliseconds
 */
export function makeCacheHeaders(
  browserCacheTime: number,
  cdnCacheDuration = browserCacheTime,
  durationFluctuation = 0.1,
): CloudFrontHeaders {
  // todo: Consider adding ETag
  const headers: CloudFrontHeaders = {}
  const fluctuationMultiplier = 1 - durationFluctuation / 2 + durationFluctuation * Math.random()

  const cacheControl = ['public', `max-age=${((browserCacheTime / 1000) * fluctuationMultiplier).toFixed()}`]
  if (browserCacheTime !== cdnCacheDuration) {
    cacheControl.push(`s-maxage=${applyFluctuation(cdnCacheDuration / 1000, durationFluctuation).toFixed()}`)
  }
  headers['cache-control'] = [{ value: cacheControl.join(', ') }]

  // When the browser cache life is longer than the CDN cache life, the "If-Modified" check will always return "true",
  // so the Last-Modified header affects nothing.
  if (browserCacheTime < cdnCacheDuration) {
    headers['last-modified'] = [{ value: new Date().toUTCString() }]
  }

  return headers
}

function applyFluctuation(value: number, fluctuation: number): number {
  return value * (1 - fluctuation / 2 + fluctuation * Math.random())
}

/**
 * Note: in contrast to Object.assign and object spread, the early headers have a higher priority
 */
function mergeHeaders(...headerSets: (CloudFrontHeaders | false | null | undefined)[]): CloudFrontHeaders {
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
