import { VersionRange } from './utils/version'

export interface Project {
  /**
   * The versions must go in ascending order.
   * If a URL matches 2 versions, the latter will be used.
   */
  versions: ProjectVersion[]
}

export interface ProjectVersion {
  /** The name of the NPM package to serve */
  npmPackage: string
  /** The versions to serve */
  versionRange: VersionRange
  /** The versions not to serve (e.g. invalid Node packages) */
  excludeVersions?: string[]
  /**
   * The files to serve in this version. The keys are the URL paths going after the version, they may include slashes.
   */
  routes: Record<string, ProjectRoute>
}

export type ProjectRoute = ProjectRedirect | ProjectPackageMainBundle | ProjectPackageMonitoring

export interface ProjectRedirect {
  type: 'redirect'
  /** A path within the same project and version. The target may but shouldn't be a redirect. */
  target: string
}

/**
 * A JS script made by converting the package's main file into the specified browser format
 */
export interface ProjectPackageMainBundle {
  type: 'packageMain'
  format: BundleFormat
  /** The name of the global (window) variable. Required for IIFE and UMD formats. */
  globalVariableName: string
  minified?: boolean
  /**
   * The words to replace in the library distributive files. The keys are the targets, the values are the replacements
   * (inserted as is). When searching, the targets are expected to be surrounded by word boundaries (\b in regexps).
   */
  replacements?: Record<string, string>
}

/**
 * An empty 200 response. Can be used for monitoring using an AJAX request
 */
export interface ProjectPackageMonitoring {
  type: 'monitoring'
}

export type BundleFormat = 'iife' | 'esm' | 'umd' | 'amd'

const fingerprintJsRouteCommon = {
  type: 'packageMain',
  globalVariableName: 'FingerprintJS',
  replacements: { 'window.__fpjs_d_m': 'true' },
} as const

const botdRouteCommon = { type: 'packageMain', globalVariableName: 'Botd' } as const

const fingerprintJsProGtmRouteCommon = { type: 'packageMain', globalVariableName: 'FingerprintjsProGTM' } as const

/**
 * The keys are the first part of the incoming URL. The keys mayn't include slashes.
 */
export const projects: Record<string, Project> = {
  // https://github.com/fingerprintjs/fingerprintjs
  fingerprintjs: {
    versions: [
      {
        npmPackage: '@fingerprintjs/fingerprintjs',
        versionRange: { start: '3' },
        routes: {
          '': { type: 'redirect', target: 'esm.min.js' },
          'iife.js': { ...fingerprintJsRouteCommon, format: 'iife' },
          'iife.min.js': { ...fingerprintJsRouteCommon, format: 'iife', minified: true },
          'esm.js': { ...fingerprintJsRouteCommon, format: 'esm' },
          'esm.min.js': { ...fingerprintJsRouteCommon, format: 'esm', minified: true },
          'umd.js': { ...fingerprintJsRouteCommon, format: 'umd' },
          'umd.min.js': { ...fingerprintJsRouteCommon, format: 'umd', minified: true },
          'npm-monitoring': { type: 'monitoring' },
        },
      },
    ],
  },

  // https://github.com/fingerprintjs/botd
  botd: {
    versions: [
      {
        npmPackage: '@fpjs-incubator/botd-agent',
        versionRange: { start: '0.1.6' }, // The older versions have invalid Node packages
        excludeVersions: ['0.1.10', '0.1.16', '0.1.16-beta.0'],
        routes: {
          '': { type: 'redirect', target: 'esm.min.js' },
          'iife.js': { ...botdRouteCommon, format: 'iife' },
          'iife.min.js': { ...botdRouteCommon, format: 'iife', minified: true },
          'esm.js': { ...botdRouteCommon, format: 'esm' },
          'esm.min.js': { ...botdRouteCommon, format: 'esm', minified: true },
          'umd.js': { ...botdRouteCommon, format: 'umd' },
          'umd.min.js': { ...botdRouteCommon, format: 'umd', minified: true },
        },
      },
    ],
  },

  // https://github.com/fingerprintjs/fingerprintjs-pro-gtm
  'fingerprintjs-pro-gtm': {
    versions: [
      {
        npmPackage: '@fingerprintjs/fingerprintjs-pro-gtm',
        versionRange: { start: '0.3.0' },
        routes: {
          'iife.js': { ...fingerprintJsProGtmRouteCommon, format: 'iife' },
          'iife.min.js': { ...fingerprintJsProGtmRouteCommon, format: 'iife', minified: true },
        },
      },
    ],
  },
}
