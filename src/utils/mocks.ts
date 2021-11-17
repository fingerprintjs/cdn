import { CloudFrontRequestEvent, Context } from 'aws-lambda'
import * as zlib from 'zlib'
import * as tarStream from 'tar-stream'
import { RegistryPackageShortData } from '../npm'

export function makeMockCloudFrontEvent(uri: string): CloudFrontRequestEvent {
  return {
    Records: [
      {
        cf: {
          config: {
            distributionDomainName: 'd111111abcdef8.cloudfront.net',
            distributionId: 'EDFDVBD6EXAMPLE',
            eventType: 'origin-request',
            requestId: '4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ==',
          },
          request: {
            clientIp: '203.0.113.178',
            headers: {},
            method: 'GET',
            querystring: '',
            uri,
          },
        },
      },
    ],
  }
}

export function makeMockLambdaContext() {
  return {} as unknown as Context
}

/**
 * A mock response data about a package from the NPM registry
 */
export const mockNpmPackageInfo: RegistryPackageShortData = {
  name: '@fpjs-incubator/botd-agent',
  'dist-tags': {
    latest: '0.3.0',
    dev: '0.2.1-dev.0',
  },
  versions: {
    '0.1.15': {
      name: '@fpjs-incubator/botd-agent',
      version: '0.1.15',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: 'd10ae3f29b70236703dc266094f999134ec9c846',
        integrity: 'sha512-voyRD+FrqLWJksQyB94OELKYNkL67MC5Wx7g9VHfhPDIC+SMgI84L2c4rynO/eSHqV2LVfPKqpR+T0oRE/+7ow==',
        tarball: 'https://registry.npmjs.org/@fpjs-incubator/botd-agent/-/botd-agent-0.1.15.tgz',
        fileCount: 12,
        unpackedSize: 476446,
        'npm-signature': '...',
      },
    },
    '0.1.16': {
      name: '@fpjs-incubator/botd-agent',
      version: '0.1.16',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: 'dc327528121dee3346adbe59c6776d0a42cd0a6f',
        integrity: 'sha512-W+lqReWjLFB0rvpX96G/0QoM+vD4563aAWAsUTWTrQ8eL8NSsfxmPyqhis8bZsp/enlLtH/Iii0J2e5RNl2GxA==',
        tarball: 'https://registry.npmjs.org/@fpjs-incubator/botd-agent/-/botd-agent-0.1.16.tgz',
        fileCount: 12,
        unpackedSize: 480467,
        'npm-signature': '...',
      },
    },
    '0.2.0': {
      name: '@fpjs-incubator/botd-agent',
      version: '0.2.0',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: 'de2f5abef524331db22b1745858e1b22bf5e86c6',
        integrity: 'sha512-uvjJIRLrDPHV9jA5+1X23o6o+PpxVzre/uZcrfuTBRnQMWM7lWkgj92GWeCG2GZKkkIbKTdAemWc0u5V7A5U8Q==',
        tarball: 'https://registry.npmjs.org/@fpjs-incubator/botd-agent/-/botd-agent-0.2.0.tgz',
        fileCount: 12,
        unpackedSize: 505276,
        'npm-signature': '...',
      },
    },
    '0.2.1': {
      name: '@fpjs-incubator/botd-agent',
      version: '0.2.1',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: '936c7d7fd563dd72428471ea7b98cb6607b7f3af',
        integrity: 'sha512-zXkfhFHnNYMXclLSYldKnsANRFDiHlcA2ZmRnDSp3D3KSE8pNVh/Ttwscc3JoNSBjSds9DO2TJYLNhAI+vJJJQ==',
        tarball: 'https://registry.npmjs.org/@fpjs-incubator/botd-agent/-/botd-agent-0.2.1.tgz',
        fileCount: 12,
        unpackedSize: 505680,
        'npm-signature': '...',
      },
    },
    '0.2.1-dev.0': {
      name: '@fpjs-incubator/botd-agent',
      version: '0.2.1-dev.0',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: '936c7d7fd563dd72428471ea7b98cb6607b7f3af',
        integrity: 'sha512-zXkfhFHnNYMXclLSYldKnsANRFDiHlcA2ZmRnDSp3D3KSE8pNVh/Ttwscc3JoNSBjSds9DO2TJYLNhAI+vJJJQ==',
        tarball: 'https://registry.npmjs.org/@fpjs-incubator/botd-agent/-/botd-agent-0.2.1-dev.0.tgz',
        fileCount: 12,
        unpackedSize: 505680,
        'npm-signature': '...',
      },
    },
    '0.3.0': {
      name: '@fpjs-incubator/botd-agent',
      version: '0.3.0',
      dependencies: { tslib: '^2.0.1' },
      devDependencies: { '@rollup/plugin-json': '^4.1.0' },
      dist: {
        shasum: 'd15c2fab8e0d9138bcb8efa1429dd780f93bb945',
        integrity: 'sha512-2kw2yVrfMKd0YvmYAdNxhGytNhhLvChqNAbBZWMglYVw2J95Jm50ketK5yS1C8SJmqG2nFJgeuWvYXeZEh+b8g==',
        tarball: 'https://registry.npmjs.org/@fpjs-incubator/botd-agent/-/botd-agent-0.3.0.tgz',
        fileCount: 12,
        unpackedSize: 524092,
        'npm-signature': '...',
      },
    },
  },
  modified: '2021-07-29T03:10:07.866Z',
}

/**
 * Makes a readable stream with an NPM package archive. You can use it with `nock` wo mock an NPM response
 */
export function mockNpmPackageDownloadStream(files: Record<string, string>): zlib.Gzip {
  const pack = tarStream.pack()
  for (const [filePath, content] of Object.entries(files)) {
    pack.entry({ name: `package/${filePath}` }, content)
  }
  pack.finalize()
  return pack.pipe(zlib.createGzip())
}
