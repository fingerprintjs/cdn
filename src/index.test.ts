import { CloudFrontRequestResult } from 'aws-lambda'
import * as nock from 'nock'
import { handler } from './index'
import * as mocks from './utils/mocks'
import { getBodyHash } from './utils/http'

/*
 * These tests make no real HTTP requests. The tests with real requests are the "integration" tests.
 */

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

it('makes the root page', async () => {
  const response = await callHandler('/')
  const expectedBody = 'This is a Fingerprint CDN'
  expect(response).toEqual({
    status: '200',
    headers: {
      etag: [{ value: `"${getBodyHash(expectedBody)}"` }],
      'cache-control': [{ value: expect.anything() }],
      'access-control-allow-origin': [{ value: '*' }],
      'cross-origin-resource-policy': [{ value: 'cross-origin' }],
      'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
      'content-type': [{ value: 'text/plain; charset=utf-8' }],
      'x-content-type-options': [{ value: 'nosniff' }],
    },
    body: expectedBody,
  })
  checkCacheHeaders(response, { browserMin: 1000 * 60 * 60 * 24 * 30, cdnMin: 1000 * 60 * 60 * 24 * 30 })
})

it('returns "not found" error', async () => {
  const response = await callHandler('/not/existing/page')
  expect(response).toEqual({
    status: '404',
    statusDescription: 'Not Found',
    headers: {
      'cache-control': [{ value: expect.anything() }],
      'access-control-allow-origin': [{ value: '*' }],
      'cross-origin-resource-policy': [{ value: 'cross-origin' }],
      'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
      'content-type': [{ value: 'text/plain; charset=utf-8' }],
      'x-content-type-options': [{ value: 'nosniff' }],
    },
    body: "The /not/existing/page path doesn't exist",
  })
  checkCacheHeaders(response, { browserMax: 1000 * 60 * 60 * 2, cdnMin: 1000 * 60 * 60 * 24 * 30 })
})

describe('inexact version', () => {
  beforeEach(() => {
    nock('https://registry.npmjs.org', {
      reqheaders: {
        Accept: 'application/vnd.npm.install-v1+json',
      },
    })
      .get('/@fpjs-incubator/botd-agent')
      .reply(200, mocks.mockNpmPackageInfo)
  })

  it('handles missing version', async () => {
    const response = await callHandler('/botd/v0.4')
    expect(response).toEqual({
      status: '404',
      statusDescription: 'Not Found',
      headers: expect.objectContaining({}),
      body: 'There is no version matching 0.4.*',
    })
    checkCacheHeaders(response, { browserMax: 1000 * 60 * 60 * 2, cdnMax: 1000 * 60 * 10 })
  })

  it('redirects to the exact version', async () => {
    const response = await callHandler('/botd/v0.1/umd.js')
    expect(response).toEqual({
      status: '302',
      statusDescription: 'Found',
      headers: expect.objectContaining({
        location: [{ value: '/botd/v0.1.15/umd.js' }], // Version 0.1.16 is excluded in the project configuration
      }),
    })
    checkCacheHeaders(response, { browserMax: 1000 * 60 * 60 * 24 * 30, cdnMax: 1000 * 60 * 60 * 24 })
  })

  it('follows the route redirect', async () => {
    const response = await callHandler('/botd/v0.2')
    expect(response).toEqual({
      status: '302',
      statusDescription: 'Found',
      headers: expect.objectContaining({
        location: [{ value: '/botd/v0.2.1/esm.min.js' }],
      }),
    })
    checkCacheHeaders(response, { browserMax: 1000 * 60 * 60 * 24 * 30, cdnMax: 1000 * 60 * 60 * 24 })
  })
})

describe('exact version', () => {
  it('redirects', async () => {
    const response = await callHandler('/fingerprintjs/v3.0.1')
    expect(response).toEqual({
      status: '301',
      statusDescription: 'Moved Permanently',
      headers: expect.objectContaining({
        location: [{ value: '/fingerprintjs/v3.0.1/esm.min.js' }],
      }),
    })
    checkCacheHeaders(response, { browserMin: 1000 * 60 * 60 * 24 * 30, cdnMin: 1000 * 60 * 60 * 24 * 30 })
  })

  it('monitors', async () => {
    const response = await callHandler('/fingerprintjs/v3.0.1/npm-monitoring')
    expect(response).toEqual({
      status: '200',
      headers: expect.objectContaining({}),
    })
    checkCacheHeaders(response, { browserMax: 1000 * 60 * 60 * 24 * 30, cdnMin: 1000 * 60 * 60 * 24 * 30 })
  })

  it('handles missing version', async () => {
    nock('https://registry.npmjs.org').get('/@fingerprintjs/fingerprintjs/-/fingerprintjs-3.2.1.tgz').reply(404)
    const response = await callHandler('/fingerprintjs/v3.2.1/esm.js')
    expect(response).toEqual({
      status: '404',
      statusDescription: 'Not Found',
      headers: expect.objectContaining({}),
      body: 'There is no version 3.2.1',
    })
    checkCacheHeaders(response, { browserMax: 1000 * 60 * 60 * 2, cdnMax: 1000 * 60 * 10 })
  })

  it('handles excluded version', async () => {
    const response = await callHandler('/botd/v0.1.16/esm.js') // Excluded in the project configuration
    expect(response).toEqual({
      status: '404',
      statusDescription: 'Not Found',
      headers: expect.objectContaining({}),
      body: "The /botd/v0.1.16/esm.js path doesn't exist",
    })
    checkCacheHeaders(response, { browserMax: 1000 * 60 * 60 * 2, cdnMin: 1000 * 60 * 60 * 24 * 30 })
  })

  const packageFiles = {
    'package.json': '{"module": "index.js"}',
    'index.js': `import {__assign} from 'tslib'
export function test() {
  if (!window.__fpjs_d_m) {
    console.log('Test') // Shall be removed
  }
  return __assign({}, {})
}`,
  }

  it('builds unminified UMD with replacements', async () => {
    nock('https://registry.npmjs.org')
      .get('/@fingerprintjs/fingerprintjs/-/fingerprintjs-3.2.1.tgz')
      .reply(200, mocks.mockNpmPackageDownloadStream(packageFiles), {
        'Content-Type': 'application/octet-stream',
      })
    const response = await callHandler('/fingerprintjs/v3.2.1/umd.js')
    expect(response).toEqual({
      status: '200',
      headers: expect.objectContaining({
        'content-type': [{ value: 'text/javascript; charset=utf-8' }],
      }),
      body: expect.anything(),
    })
    expect(response?.body).toMatchSnapshot()
    expect(response?.headers?.etag).toMatchSnapshot()
    checkCacheHeaders(response, { browserMin: 1000 * 60 * 60 * 24 * 30, cdnMin: 1000 * 60 * 60 * 24 * 30 })
  })

  it('builds minified ESM', async () => {
    nock('https://registry.npmjs.org')
      .get('/@fpjs-incubator/botd-agent/-/botd-agent-0.1.20.tgz')
      .reply(200, mocks.mockNpmPackageDownloadStream(packageFiles), {
        'Content-Type': 'application/octet-stream',
      })
    const response = await callHandler('/botd/v0.1.20/esm.min.js')
    expect(response).toEqual({
      status: '200',
      headers: expect.objectContaining({}),
      body: expect.anything(),
    })
    expect(response?.body).toMatchSnapshot()
    expect(response?.headers?.etag).toMatchSnapshot()
  })
})

function callHandler(uri: string) {
  return handler(mocks.makeMockCloudFrontEvent(uri), mocks.makeMockLambdaContext(), () => undefined)
}

function checkCacheHeaders(
  response: CloudFrontRequestResult | void,
  options: { browserMin?: number; browserMax?: number; cdnMin?: number; cdnMax?: number },
) {
  expect(response?.headers?.['cache-control']?.length || 0).toBe(1)
  const cacheControlHeader = response?.headers?.['cache-control'][0].value || ''
  let browserCacheTime: number
  let cdnCacheTime: number

  let match = /^\s*public,\s*max-age=(\d+),\s*s-maxage=(\d+)\s*$/.exec(cacheControlHeader)
  if (match) {
    browserCacheTime = Number(match[1]) * 1000
    cdnCacheTime = Number(match[2]) * 1000
  } else {
    match = /^\s*public,\s*max-age=(\d+)\s*$/.exec(cacheControlHeader)
    if (match) {
      browserCacheTime = cdnCacheTime = Number(match[1]) * 1000
    } else {
      throw new Error('Unexpected Cache-Control header value')
    }
  }

  if (options.browserMin !== undefined) {
    expect(browserCacheTime).toBeGreaterThanOrEqual(options.browserMin)
  }
  if (options.browserMax !== undefined) {
    expect(browserCacheTime).toBeLessThanOrEqual(options.browserMax)
  }
  if (options.cdnMin !== undefined) {
    expect(cdnCacheTime).toBeGreaterThanOrEqual(options.cdnMin)
  }
  if (options.cdnMax !== undefined) {
    expect(cdnCacheTime).toBeLessThanOrEqual(options.cdnMax)
  }
}
