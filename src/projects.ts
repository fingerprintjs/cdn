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

export type ProjectRoute = ProjectRedirect | ProjectPackageMainBundle

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
  minified: boolean
}

export type BundleFormat = 'iife' | 'esm' | 'umd'

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
          'iife.js': { type: 'packageMain', format: 'iife', minified: false },
          'iife.min.js': { type: 'packageMain', format: 'iife', minified: true },
          'esm.js': { type: 'packageMain', format: 'esm', minified: false },
          'esm.min.js': { type: 'packageMain', format: 'esm', minified: true },
          'umd.js': { type: 'packageMain', format: 'umd', minified: false },
          'umd.min.js': { type: 'packageMain', format: 'umd', minified: true },
        },
      },
    ],
  },
}
