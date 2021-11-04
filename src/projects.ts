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
  /**
   * The files to serve in this version. The keys are the URL paths going after the version, they may include slashes.
   */
  routes: Record<string, ProjectRoute>
}

export type ProjectRoute = ProjectRedirect | ProjectPackageMainBundle | ProjectPackageMonitoring

export interface ProjectRedirect {
  type: 'redirect'
  /** A path within the same project and version */
  target: string
}

/**
 * A JS script made by converting the package's main file into the specified browser format
 */
export interface ProjectPackageMainBundle {
  type: 'packageMain'
  format: BundleFormat
  globalVariableName: string
  minified?: boolean
}

/**
 * An empty 200 response. Can be used for monitoring using an AJAX request
 */
export interface ProjectPackageMonitoring {
  type: 'monitoring'
}

export type BundleFormat = 'iife' | 'esm' | 'umd'

const fingerprintJsRouteCommon = { type: 'packageMain', globalVariableName: 'FingerprintJS' } as const

/**
 * The keys are the first part of the incoming URL. The keys mayn't include slashes.
 */
export const projects: Record<string, Project> = {
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
}
