import * as nock from 'nock'
import { handler } from './index'
import * as mocks from './utils/mocks'

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

function callHandler(uri: string) {
  return handler(mocks.makeMockCloudFrontEvent(uri), mocks.makeMockLambdaContext(), () => undefined)
}

it('makes the root page', async () => {
  const response = await callHandler('/')
  expect(response).toEqual({
    status: '200',
    headers: {
      'cache-control': [{ value: expect.stringMatching(/^\s*public,\s*max-age=\d+\s*$/) }],
      'access-control-allow-origin': [{ value: '*' }],
      'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
      'content-type': [{ value: 'text/plain; charset=utf-8' }],
      'x-content-type-options': [{ value: 'nosniff' }],
    },
    body: 'This is a FingerprintJS CDN',
  })
})

it('returns "not found" error', async () => {
  const response = await callHandler('/not/existing/page')
  expect(response).toEqual({
    status: '404',
    statusDescription: 'Not Found',
    headers: {
      'cache-control': [{ value: expect.stringMatching(/^\s*public,\s*max-age=\d+,\s*s-maxage=\d+\s*$/) }],
      'access-control-allow-origin': [{ value: '*' }],
      'strict-transport-security': [{ value: 'max-age=63072000; includeSubDomains; preload' }],
      'content-type': [{ value: 'text/plain; charset=utf-8' }],
      'x-content-type-options': [{ value: 'nosniff' }],
    },
    body: "The /not/existing/page path doesn't exist",
  })
})

describe('inexact version', () => {
  beforeEach(() => {
    nock('https://registry.npmjs.org', {
      reqheaders: {
        Accept: 'application/vnd.npm.install-v1+json',
      },
    })
      .get('/@fingerprintjs/fingerprintjs')
      .reply(200, mocks.mockNpmPackageInfo)
  })

  it('handles missing version', async () => {
    const response = await callHandler('/fingerprintjs/v3.0')
    expect(response).toEqual({
      status: '404',
      statusDescription: 'Not Found',
      headers: expect.objectContaining({}),
      body: 'There is no version matching 3.0.*',
    })
  })

  it('redirects to the exact version', async () => {
    const response = await callHandler('/fingerprintjs/v3.2/umd.js')
    expect(response).toEqual({
      status: '302',
      statusDescription: 'Found',
      headers: expect.objectContaining({
        location: [{ value: '/fingerprintjs/v3.2.1/umd.js' }],
      }),
    })
  })

  it('follows the route redirect', async () => {
    const response = await callHandler('/fingerprintjs/v3.2')
    expect(response).toEqual({
      status: '302',
      statusDescription: 'Found',
      headers: expect.objectContaining({
        location: [{ value: '/fingerprintjs/v3.2.1/esm.min.js' }],
      }),
    })
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
  })

  it('monitors', async () => {
    const response = await callHandler('/fingerprintjs/v3.0.1/npm-monitoring')
    expect(response).toEqual({
      status: '200',
      headers: expect.objectContaining({}),
    })
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
  })
})
