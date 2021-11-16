import * as path from 'path'
import { promises as fs } from 'fs'
import * as nock from 'nock'
import { mockNpmPackageDownloadStream, mockNpmPackageInfo } from './utils/mocks'
import { downloadPackage, ErrorName, getPackageGreatestVersion } from './npm'

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

describe('getPackageGreatestVersion', () => {
  it('gets the greatest version', async () => {
    nock('https://registry.npmjs.org', {
      reqheaders: {
        Accept: 'application/vnd.npm.install-v1+json',
      },
    })
      .get('/@fpjs-incubator/botd-agent')
      .reply(200, mockNpmPackageInfo)
    const version = await getPackageGreatestVersion(
      '@fpjs-incubator/botd-agent',
      { start: '0.1', end: '0.2' },
      ['0.1.16', '0.1.17'],
      true,
    )
    expect(version).toEqual('0.1.15')
  })

  it('throws if there is no matching version', async () => {
    nock('https://registry.npmjs.org', {
      reqheaders: {
        Accept: 'application/vnd.npm.install-v1+json',
      },
    })
      .get('/@fpjs-incubator/botd-agent')
      .reply(200, mockNpmPackageInfo)
    await expect(
      getPackageGreatestVersion('@fpjs-incubator/botd-agent', { start: '0.0', end: '0.1' }, undefined, true),
    ).rejects.toEqual(
      expect.objectContaining({
        name: ErrorName.NpmNotFound,
        message: 'No version of the NPM package matches ≥0.0 and <0.1',
      }),
    )
  })

  it("throws if the package name doesn't exist", async () => {
    nock('https://registry.npmjs.org').get('/foobar').reply(404)
    await expect(getPackageGreatestVersion('foobar')).rejects.toEqual(
      expect.objectContaining({
        name: ErrorName.NpmNotFound,
        message: "The package foobar doesn't exist on NPM",
      }),
    )
  })

  it('throws if the package name is invalid', async () => {
    nock('https://registry.npmjs.org')
    await expect(getPackageGreatestVersion('../trying/to/hack')).rejects.toEqual(
      expect.objectContaining({ name: ErrorName.InvalidPackageName }),
    )
  })

  it('propagates unexpected errors', async () => {
    nock('https://registry.npmjs.org').get('/@foo/bar').reply(403, 'You are blocked')
    await expect(getPackageGreatestVersion('@foo/bar')).rejects.toEqual(
      expect.objectContaining({
        name: 'HTTPError',
        response: expect.objectContaining({
          statusCode: 403,
          body: 'You are blocked',
        }),
      }),
    )
  })
})

describe('downloadPackage', () => {
  it('downloads package', async () => {
    // Random names are used to avoid the built-in cache
    const packageScopelessName = `foo-${Math.random().toString(36).slice(2)}`
    const packageName = `@test/${packageScopelessName}`
    nock('https://registry.npmjs.org')
      .get(`/${packageName}/-/${packageScopelessName}-1.2.3.tgz`)
      .reply(
        200,
        mockNpmPackageDownloadStream({
          'package.json': '{"module": "index.js"}',
          'index.js': 'console.log("Hello, world")',
        }),
        {
          'Content-Type': 'application/octet-stream',
        },
      )
    const directory = await downloadPackage(packageName, '1.2.3')
    try {
      await expect(fs.readFile(path.join(directory, 'package.json'), 'utf8')).resolves.toBe('{"module": "index.js"}')
      await expect(fs.readFile(path.join(directory, 'index.js'), 'utf8')).resolves.toBe('console.log("Hello, world")')
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('caches downloaded packages', async () => {
    const packageScopelessName = `foo-${Math.random().toString(36).slice(2)}`
    const packageName = `@test/${packageScopelessName}`
    // If the function tries to query NPM one more time, nock will emit an error
    nock('https://registry.npmjs.org')
      .get(`/${packageName}/-/${packageScopelessName}-1.2.3.tgz`)
      .reply(
        200,
        mockNpmPackageDownloadStream({
          'package.json': '{"module": "index.js"}',
          'index.js': 'console.log("Hello, world")',
        }),
        {
          'Content-Type': 'application/octet-stream',
        },
      )
    const directory1 = await downloadPackage(packageName, '1.2.3')
    try {
      const directory2 = await downloadPackage(packageName, '1.2.3')
      try {
        expect(directory2).toBe(directory1)
      } finally {
        await fs.rm(directory2, { recursive: true, force: true })
      }
    } finally {
      await fs.rm(directory1, { recursive: true, force: true })
    }
  })

  it("throws if the package name or version don't exist", async () => {
    const packageName = `test-${Math.random().toString(36).slice(2)}`
    nock('https://registry.npmjs.org').get(`/${packageName}/-/${packageName}-4.3.2.tgz`).reply(404)
    await expect(downloadPackage(packageName, '4.3.2')).rejects.toEqual(
      expect.objectContaining({
        name: ErrorName.NpmNotFound,
        message: `The package ${packageName} or its version 4.3.2 don't exist on NPM`,
      }),
    )
  })

  it('throws if the package name is invalid', async () => {
    nock('https://registry.npmjs.org')
    await expect(downloadPackage('../trying/to/hack', '1.3.0')).rejects.toEqual(
      expect.objectContaining({ name: ErrorName.InvalidPackageName }),
    )
  })

  it('throws if the version name is invalid', async () => {
    nock('https://registry.npmjs.org')
    await expect(downloadPackage('@test/foo', '../hack/you')).rejects.toEqual(
      expect.objectContaining({ name: ErrorName.InvalidVersionName }),
    )
  })

  it('propagates unexpected errors', async () => {
    const packageName = `test-${Math.random().toString(36).slice(2)}`
    nock('https://registry.npmjs.org').get(`/${packageName}/-/${packageName}-4.3.2.tgz`).reply(403, 'Sorry')
    await expect(downloadPackage(packageName, '4.3.2')).rejects.toEqual(
      expect.objectContaining({
        name: 'HTTPError',
        response: expect.objectContaining({
          statusCode: 403,
          body: 'Sorry',
        }),
      }),
    )
  })
})
