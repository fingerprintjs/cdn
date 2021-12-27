import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { CloudFrontRequestHandler } from 'aws-lambda'
import { isDirectory } from './utils/filesystem'
import * as mocks from './utils/mocks'

let outsideDistDirectory = ''
let handler: CloudFrontRequestHandler = () => undefined

// Copies the dist directory to an outside location so that it can't access the project's node modules.
// Imports the copied distributive lambda to the `handler` variable.
beforeAll(async () => {
  const distDirectory = path.join(__dirname, '..', 'dist')
  if (!(await isDirectory(distDirectory))) {
    throw new Error('Build the project (run `yarn build`) before running these tests')
  }
  outsideDistDirectory = path.join(os.tmpdir(), `fpjs-${Math.random().toString(36).slice(2)}`)
  await fs.symlink(distDirectory, outsideDistDirectory, 'dir')
  handler = (await import(path.join(outsideDistDirectory, 'src', 'index'))).handler
})

afterAll(async () => {
  if (outsideDistDirectory.startsWith(os.tmpdir())) {
    await fs.rm(outsideDistDirectory, { recursive: true, force: true })
  }
})

function callHandler(uri: string) {
  return handler(mocks.makeMockCloudFrontEvent(uri), mocks.makeMockLambdaContext(), () => undefined)
}

describe('inexact version', () => {
  it('redirects to the latest appropriate version', async () => {
    const response = await callHandler('/fingerprintjs/v3.1')
    expect(response).toEqual({
      status: '302',
      statusDescription: 'Found',
      headers: expect.objectContaining({
        location: [{ value: '/fingerprintjs/v3.1.3/esm.min.js' }],
        'cache-control': [{ value: expect.stringMatching(/^\s*public,\s*max-age=\d+,\s*s-maxage=\d+\s*$/) }],
      }),
    })
  })

  it('handles missing version', async () => {
    // This version is within the project, but it doesn't really exist
    const response = await callHandler('/fingerprintjs/v3.54/esm.min.js')
    expect(response).toEqual({
      status: '404',
      statusDescription: 'Not Found',
      headers: expect.objectContaining({
        'cache-control': [{ value: expect.stringMatching(/^\s*public,\s*max-age=\d+,\s*s-maxage=\d+\s*$/) }],
        'content-type': [{ value: 'text/plain; charset=utf-8' }],
      }),
      body: 'There is no version matching 3.54.*',
    })
  })
})

describe('exact version', () => {
  it('downloads and builds', async () => {
    // This version imports `tslib`, so the proper dependency handling is checked too
    const response = await callHandler('/botd/v0.1.20/iife.min.js')
    expect(response).toEqual({
      status: '200',
      headers: expect.objectContaining({
        'cache-control': [{ value: expect.stringMatching(/^\s*public,\s*max-age=\d+\s*$/) }],
        'content-type': [{ value: 'text/javascript; charset=utf-8' }],
      }),
      body: expect.anything(),
    })
    expect(response?.body).toMatchSnapshot()
    expect(response?.headers?.etag).toMatchSnapshot()
  })

  it('handles missing version', async () => {
    // This version is within the project, but it doesn't really exist
    const response = await callHandler('/fingerprintjs/v3.1.9/esm.min.js')
    expect(response).toEqual({
      status: '404',
      statusDescription: 'Not Found',
      headers: expect.objectContaining({
        'cache-control': [{ value: expect.stringMatching(/^\s*public,\s*max-age=\d+,\s*s-maxage=\d+\s*$/) }],
        'content-type': [{ value: 'text/plain; charset=utf-8' }],
      }),
      body: 'There is no version 3.1.9',
    })
  })
})
