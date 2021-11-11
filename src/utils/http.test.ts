import { makeCacheHeaders, okStatus, temporaryRedirectStatus, withBestPractices } from './http'
import { makeMockCloudFrontEvent } from './mocks'

describe('withBestPractices', () => {
  it('handles missing headers', async () => {
    expect(await withBestPractices(() => ({ ...okStatus, body: 'Hello' }))(makeMockCloudFrontEvent('/'))).toEqual({
      status: '200',
      headers: {
        'access-control-allow-origin': [{ value: '*' }],
        'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
        'content-type': [{ value: 'text/plain; charset=UTF-8' }],
        'x-content-type-options': [{ value: 'nosniff' }],
      },
      body: 'Hello',
    })
  })

  it("doesn't replace the headers", async () => {
    expect(
      await withBestPractices(() => ({
        ...okStatus,
        headers: { 'content-type': [{ value: 'text/javascript' }], 'access-control-allow-origin': [] },
      }))(makeMockCloudFrontEvent('/foo')),
    ).toEqual({
      status: '200',
      headers: {
        'access-control-allow-origin': [{ value: '*' }],
        'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
        'content-type': [{ value: 'text/javascript' }],
        'x-content-type-options': [{ value: 'nosniff' }],
      },
    })
  })

  it('handles redirects', async () => {
    expect(
      await withBestPractices(() => ({ ...temporaryRedirectStatus, headers: { location: [{ value: '/foo/bar' }] } }))(
        makeMockCloudFrontEvent('/foo'),
      ),
    ).toEqual({
      status: '302',
      statusDescription: 'Found',
      headers: {
        'access-control-allow-origin': [{ value: '*' }],
        'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
        location: [{ value: '/foo/bar' }],
      },
    })
  })
})

describe('makeCacheHeaders', () => {
  it('handles greater server cache time', () => {
    const headers = makeCacheHeaders(100e3, 1000e3, 0.2)
    expect(headers).toEqual({
      'cache-control': [{ value: expect.anything() }],
      'last-modified': [{ value: expect.anything() }],
    })
    const match = /^\s*public,\s*max-age=(\d+),\s*s-maxage=(\d+)\s*$/.exec(headers['cache-control'][0].value)
    if (!match) {
      throw new Error("The string doesn't match the pattern")
    }
    expect(Number(match[1])).toBeGreaterThanOrEqual(90)
    expect(Number(match[1])).toBeLessThanOrEqual(110)
    expect(Number(match[2])).toBeGreaterThanOrEqual(900)
    expect(Number(match[2])).toBeLessThanOrEqual(1100)
    expect(new Date(headers['last-modified'][0].value).getTime()).toBeGreaterThan(Date.now() - 1000)
    expect(new Date(headers['last-modified'][0].value).getTime()).toBeLessThan(Date.now() + 1000)
  })

  it('handles greater browser cache time', () => {
    const headers = makeCacheHeaders(2000e3, 200e3, 0.4)
    expect(headers).toEqual({ 'cache-control': [{ value: expect.anything() }] })
    const match = /^\s*public,\s*max-age=(\d+),\s*s-maxage=(\d+)\s*$/.exec(headers['cache-control'][0].value)
    if (!match) {
      throw new Error("The string doesn't match the pattern")
    }
    expect(Number(match[1])).toBeGreaterThanOrEqual(1600)
    expect(Number(match[1])).toBeLessThanOrEqual(2400)
    expect(Number(match[2])).toBeGreaterThanOrEqual(160)
    expect(Number(match[2])).toBeLessThanOrEqual(240)
  })

  it('handles same cache time', () => {
    const headers = makeCacheHeaders(3000e3, 3000e3, 0.2)
    expect(headers).toEqual({ 'cache-control': [{ value: expect.anything() }] })
    const match = /^\s*public,\s*max-age=(\d+)\s*$/.exec(headers['cache-control'][0].value)
    if (!match) {
      throw new Error("The string doesn't match the pattern")
    }
    expect(Number(match[1])).toBeGreaterThanOrEqual(2700)
    expect(Number(match[1])).toBeLessThanOrEqual(3300)
  })
})
