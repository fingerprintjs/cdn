export interface Project {
  /** The name of the NPM package to serve */
  npmName: string
  versions: ProjectVersion[]
}

export interface ProjectVersion {
  /** The minimal version to serve. It's included. For example: '3', '3.3', '3.3.0' */
  startVersion?: string
  /** The first version to not serve. It's not included. */
  endVersion?: string
  /** The files to serve in this version. The keys are the URL paths going after the version. */
  routes: Record<string, ProjectRoute>
}

export type ProjectRoute = ProjectRedirect | ProjectPackageMainBundle

export interface ProjectRedirect {
  type: 'redirect'
  /** A path within the same project and version */
  target: string
}

/**
 * A browser version of the package's main file
 */
export interface ProjectPackageMainBundle {
  type: 'packageMain'
  format: BundleFormat
  minified: boolean
}

export type BundleFormat = 'iife' | 'esm' | 'umd'

/**
 * The keys are the first part of the incoming URL
 */
export const projects: Record<string, Project> = {
  fingerprintjs: {
    npmName: '@fingerprintjs/fingerprintjs',
    versions: [
      {
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
