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
  const cacheControl = [
    'public',
    `max-age=${applyFluctuation(browserCacheDuration / 1000, durationFluctuation).toFixed()}`,
  ]
  if (browserCacheDuration !== cdnCacheDuration) {
    cacheControl.push(`s-maxage=${applyFluctuation(cdnCacheDuration / 1000, durationFluctuation).toFixed()}`)
  }
  return {
    'cache-control': [{ value: cacheControl.join(', ') }],
    'last-modified': [{ value: new Date().toUTCString() }],
  }
}

function applyFluctuation(value: number, fluctuation: number): number {
  return value * (1 - fluctuation / 2 + fluctuation * Math.random())
}
