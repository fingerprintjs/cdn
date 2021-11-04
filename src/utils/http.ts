import { CloudFrontHeaders, CloudFrontResultResponse } from 'aws-lambda'

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

export function makeCorsHeaders(): CloudFrontHeaders {
  return {
    'access-control-allow-origin': [{ value: '*' }],
  }
}

/**
 * Notice: the durations are set in milliseconds like everything else in JavaScript
 */
export function makeCacheHeaders(
  browserCacheDuration: number,
  cdnCacheDuration = browserCacheDuration,
  durationFluctuation = 0.1,
): CloudFrontHeaders {
  // todo: Consider adding ETag
  const headers: CloudFrontHeaders = {}
  const fluctuationMultiplier = 1 - durationFluctuation / 2 + durationFluctuation * Math.random()
  const cacheControl = ['public', `max-age=${((browserCacheDuration / 1000) * fluctuationMultiplier).toFixed()}`]

  if (browserCacheDuration !== cdnCacheDuration) {
    cacheControl.push(`s-maxage=${applyFluctuation(cdnCacheDuration / 1000, durationFluctuation).toFixed()}`)

    // When the browser cache life is longer than the CDN cache life, the "If-Modified" check will always return "true",
    // so the Last-Modified header affects nothing.
    if (browserCacheDuration < cdnCacheDuration) {
      headers['last-modified'] = [{ value: new Date().toUTCString() }]
    }
  }

  headers['cache-control'] = [{ value: cacheControl.join(', ') }]
  return headers
}

function applyFluctuation(value: number, fluctuation: number): number {
  return value * (1 - fluctuation / 2 + fluctuation * Math.random())
}
