import * as path from 'path'
import { promises as fs } from 'fs'
import * as zlib from 'zlib'
import * as nock from 'nock'
import * as tarStream from 'tar-stream'
import { downloadPackage, ErrorName, getPackageGreatestVersion, RegistryPackageShortData } from './npm'

/*
 * These tests make no real HTTP requests. The tests with real requests are the "integration" tests.
 */

const mockPackageInfo: RegistryPackageShortData = {
  name: '@fingerprintjs/fingerprintjs',
  'dist-tags': {
    latest: '3.3.0',
    dev: '3.2.1-dev.0',
  },
  versions: {
    '3.1.2': {
      name: '@fingerprintjs/fingerprintjs',
      version: '3.1.2',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: 'd10ae3f29b70236703dc266094f999134ec9c846',
        integrity: 'sha512-voyRD+FrqLWJksQyB94OELKYNkL67MC5Wx7g9VHfhPDIC+SMgI84L2c4rynO/eSHqV2LVfPKqpR+T0oRE/+7ow==',
        tarball: 'https://registry.npmjs.org/@fingerprintjs/fingerprintjs/-/fingerprintjs-3.1.2.tgz',
        fileCount: 12,
        unpackedSize: 476446,
        'npm-signature': '...',
      },
    },
    '3.1.3': {
      name: '@fingerprintjs/fingerprintjs',
      version: '3.1.3',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: 'dc327528121dee3346adbe59c6776d0a42cd0a6f',
        integrity: 'sha512-W+lqReWjLFB0rvpX96G/0QoM+vD4563aAWAsUTWTrQ8eL8NSsfxmPyqhis8bZsp/enlLtH/Iii0J2e5RNl2GxA==',
        tarball: 'https://registry.npmjs.org/@fingerprintjs/fingerprintjs/-/fingerprintjs-3.1.3.tgz',
        fileCount: 12,
        unpackedSize: 480467,
        'npm-signature': '...',
      },
    },
    '3.2.0': {
      name: '@fingerprintjs/fingerprintjs',
      version: '3.2.0',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: 'de2f5abef524331db22b1745858e1b22bf5e86c6',
        integrity: 'sha512-uvjJIRLrDPHV9jA5+1X23o6o+PpxVzre/uZcrfuTBRnQMWM7lWkgj92GWeCG2GZKkkIbKTdAemWc0u5V7A5U8Q==',
        tarball: 'https://registry.npmjs.org/@fingerprintjs/fingerprintjs/-/fingerprintjs-3.2.0.tgz',
        fileCount: 12,
        unpackedSize: 505276,
        'npm-signature': '...',
      },
    },
    '3.2.1': {
      name: '@fingerprintjs/fingerprintjs',
      version: '3.2.1',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: '936c7d7fd563dd72428471ea7b98cb6607b7f3af',
        integrity: 'sha512-zXkfhFHnNYMXclLSYldKnsANRFDiHlcA2ZmRnDSp3D3KSE8pNVh/Ttwscc3JoNSBjSds9DO2TJYLNhAI+vJJJQ==',
        tarball: 'https://registry.npmjs.org/@fingerprintjs/fingerprintjs/-/fingerprintjs-3.2.1.tgz',
        fileCount: 12,
        unpackedSize: 505680,
        'npm-signature': '...',
      },
    },
    '3.2.1-dev.0': {
      name: '@fingerprintjs/fingerprintjs',
      version: '3.2.1-dev.0',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: '936c7d7fd563dd72428471ea7b98cb6607b7f3af',
        integrity: 'sha512-zXkfhFHnNYMXclLSYldKnsANRFDiHlcA2ZmRnDSp3D3KSE8pNVh/Ttwscc3JoNSBjSds9DO2TJYLNhAI+vJJJQ==',
        tarball: 'https://registry.npmjs.org/@fingerprintjs/fingerprintjs/-/fingerprintjs-3.2.1-dev.0.tgz',
        fileCount: 12,
        unpackedSize: 505680,
        'npm-signature': '...',
      },
    },
    '3.3.0': {
      name: '@fingerprintjs/fingerprintjs',
      version: '3.3.0',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: 'd15c2fab8e0d9138bcb8efa1429dd780f93bb945',
        integrity: 'sha512-2kw2yVrfMKd0YvmYAdNxhGytNhhLvChqNAbBZWMglYVw2J95Jm50ketK5yS1C8SJmqG2nFJgeuWvYXeZEh+b8g==',
        tarball: 'https://registry.npmjs.org/@fingerprintjs/fingerprintjs/-/fingerprintjs-3.3.0.tgz',
        fileCount: 12,
        unpackedSize: 524092,
        'npm-signature': '...',
      },
    },
  },
  modified: '2021-07-29T03:10:07.866Z',
}

describe('getPackageGreatestVersion', () => {
  it('gets the greatest version', async () => {
    nock('https://registry.npmjs.org', {
      reqheaders: {
        Accept: 'application/vnd.npm.install-v1+json',
      },
    })
      .get('/@fingerprintjs/fingerprintjs')
      .reply(200, mockPackageInfo)
    const version = await getPackageGreatestVersion('@fingerprintjs/fingerprintjs', { start: '3.2', end: '3.3' }, true)
    expect(version).toEqual('3.2.1')
  })

  it('throws if there is no matching version', async () => {
    nock('https://registry.npmjs.org', {
      reqheaders: {
        Accept: 'application/vnd.npm.install-v1+json',
      },
    })
      .get('/@fingerprintjs/fingerprintjs')
      .reply(200, mockPackageInfo)
    await expect(
      getPackageGreatestVersion('@fingerprintjs/fingerprintjs', { start: '3.0', end: '3.1' }, true),
    ).rejects.toEqual(
      expect.objectContaining({
        name: ErrorName.NpmNotFound,
        message: 'No version of the NPM package matches ≥3.0 and <3.1',
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
  function mockPackageDownloadStream(files: Record<string, string>) {
    const pack = tarStream.pack()
    for (const [filePath, content] of Object.entries(files)) {
      pack.entry({ name: `package/${filePath}` }, content)
    }
    pack.finalize()
    return pack.pipe(zlib.createGzip())
  }

  it('downloads package', async () => {
    // Random names are used to avoid the built-in cache
    const packageScopelessName = `foo-${String(Math.random()).slice(2)}`
    const packageName = `@test/${packageScopelessName}`
    nock('https://registry.npmjs.org')
      .get(`/${packageName}/-/${packageScopelessName}-1.2.3.tgz`)
      .reply(
        200,
        mockPackageDownloadStream({
          'package.json': '{"main": "index.js"}',
          'index.js': 'console.log("Hello, world")',
        }),
        {
          'Content-Type': 'application/octet-stream',
        },
      )
    const directory = await downloadPackage(packageName, '1.2.3')
    try {
      await expect(fs.readFile(path.join(directory, 'package.json'), 'utf8')).resolves.toBe('{"main": "index.js"}')
      await expect(fs.readFile(path.join(directory, 'index.js'), 'utf8')).resolves.toBe('console.log("Hello, world")')
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it("throws if the package name or version don't exist", async () => {
    const packageName = `test-${String(Math.random()).slice(2)}`
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
    const packageName = `test-${String(Math.random()).slice(2)}`
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
