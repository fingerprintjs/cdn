import * as httpUtil from './http'
import { makeMockCloudFrontEvent, makeMockLambdaContext } from './mocks'

describe('withBestPractices', () => {
  it('handles missing headers', async () => {
    const body = 'Hello'
    const handler = httpUtil.withBestPractices(async () => ({ ...httpUtil.okStatus, body }))
    expect(await handler(makeMockCloudFrontEvent('/'), makeMockLambdaContext())).toEqual({
      status: '200',
      headers: {
        'access-control-allow-origin': [{ value: '*' }],
        'cross-origin-resource-policy': [{ value: 'cross-origin' }],
        'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
        'content-type': [{ value: 'text/plain; charset=utf-8' }],
        'x-content-type-options': [{ value: 'nosniff' }],
        etag: [{ value: `"${httpUtil.getBodyHash(body)}"` }],
      },
      body,
    })
  })

  it("doesn't replace the headers", async () => {
    const handler = httpUtil.withBestPractices(async () => ({
      ...httpUtil.okStatus,
      headers: {
        'content-type': [{ value: 'text/javascript' }],
        'access-control-allow-origin': [],
        etag: [{ value: '"foo"' }],
      },
      body: 'Hello',
    }))
    expect(await handler(makeMockCloudFrontEvent('/foo'), makeMockLambdaContext())).toEqual({
      status: '200',
      headers: {
        'access-control-allow-origin': [{ value: '*' }],
        'cross-origin-resource-policy': [{ value: 'cross-origin' }],
        'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
        'content-type': [{ value: 'text/javascript' }],
        'x-content-type-options': [{ value: 'nosniff' }],
        etag: [{ value: '"foo"' }],
      },
      body: 'Hello',
    })
  })

  it("doesn't add Content-Type headers to redirects with no body", async () => {
    const handler = httpUtil.withBestPractices(async () => ({
      ...httpUtil.temporaryRedirectStatus,
      headers: { location: [{ value: '/foo/bar' }] },
    }))
    expect(await handler(makeMockCloudFrontEvent('/foo'), makeMockLambdaContext())).toEqual({
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{ value: '/foo/bar' }],
        'access-control-allow-origin': [{ value: '*' }],
        'cross-origin-resource-policy': [{ value: 'cross-origin' }],
        'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
      },
    })
  })

  it("doesn't add an Etag to empty responses", async () => {
    const handler = httpUtil.withBestPractices(async () => ({
      ...httpUtil.okStatus,
      body: '',
    }))
    const response = await handler(makeMockCloudFrontEvent('/'), makeMockLambdaContext())
    expect(response.headers?.etag).toBeUndefined()
  })

  it("doesn't add an Etag to error responses", async () => {
    const handler = httpUtil.withBestPractices(async () => ({
      ...httpUtil.notFoundStatus,
      body: 'Oops, the resource is not found',
    }))
    const response = await handler(makeMockCloudFrontEvent('/foo'), makeMockLambdaContext())
    expect(response.headers?.etag).toBeUndefined()
  })
})

describe('makeCacheControlHeaders', () => {
  it('handles different cache times', () => {
    const headers = httpUtil.makeCacheControlHeaders(100e3, 1000e3, 0.2)
    expect(headers).toEqual({
      'cache-control': [{ value: expect.anything() }],
    })
    const match = /^\s*public,\s*max-age=(\d+),\s*s-maxage=(\d+)\s*$/.exec(headers['cache-control'][0].value)
    if (!match) {
      throw new Error("The string doesn't match the pattern")
    }
    expect(Number(match[1])).toBeGreaterThanOrEqual(90)
    expect(Number(match[1])).toBeLessThanOrEqual(110)
    expect(Number(match[2])).toBeGreaterThanOrEqual(900)
    expect(Number(match[2])).toBeLessThanOrEqual(1100)
  })

  it('handles same cache time', () => {
    const headers = httpUtil.makeCacheControlHeaders(3000e3, 3000e3, 0.2)
    expect(headers).toEqual({ 'cache-control': [{ value: expect.anything() }] })
    const match = /^\s*public,\s*max-age=(\d+)\s*$/.exec(headers['cache-control'][0].value)
    if (!match) {
      throw new Error("The string doesn't match the pattern")
    }
    expect(Number(match[1])).toBeGreaterThanOrEqual(2700)
    expect(Number(match[1])).toBeLessThanOrEqual(3300)
  })
})

describe('getBodyHash', () => {
  it('works', () => {
    expect(httpUtil.getBodyHash('Hello')).toBe('9/+ei3uy4Jtwk1pdeF4MxdnQq/A')
    expect(httpUtil.getBodyHash(new Array(10000).fill('Hello').join(' '))).toBe('Y+IFCAH90Vn856lZCAljU34QHT0')
  })
})
