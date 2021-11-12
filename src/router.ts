import { Project, ProjectRoute, projects, ProjectVersion } from './projects'
import * as versionUtil from './utils/version'

interface ExactVersion extends ProjectVersion {
  requestedType: 'exact'
  requestedVersion: string
}

interface InexactVersion extends ProjectVersion {
  requestedType: 'inexact'
  requestedRange: versionUtil.VersionRange
}

export interface UriData {
  project: Project & { key: string }
  version: ExactVersion | InexactVersion
  route: ProjectRoute & { path: string }
}

export type UriDataExactVersion = UriData & { version: ExactVersion }
export type UriDataInexactVersion = UriData & { version: InexactVersion }

/**
 * Parses a URI of an incoming request.
 * The URI is expected to always start with a slash.
 */
export function parseRequestUri(uri: string): UriData | undefined {
  const uriMatch = /^\/([^/]*)\/v([^/]*)(?:\/(.+))?$/.exec(uri)
  if (!uriMatch) {
    return undefined
  }

  const projectKey = decodeURIComponent(uriMatch[1])
  if (!Object.prototype.hasOwnProperty.call(projects, projectKey)) {
    return undefined
  }
  const project = projects[projectKey]

  const rawVersion = decodeURIComponent(uriMatch[2])
  const version = findAppropriateVersion(project.versions, rawVersion)
  if (!version) {
    return undefined
  }

  const routePath = (uriMatch[3] || '').split('/').map(decodeURIComponent).join('/')
  if (!Object.prototype.hasOwnProperty.call(version.routes, routePath)) {
    return undefined
  }
  const route = version.routes[routePath]

  return {
    project: { ...project, key: projectKey },
    version,
    route: { ...route, path: routePath },
  }
}

/**
 * Builds the URI of an incoming request (e.g. for redirect).
 * The returned URI starts with a slash.
 */
export function makeRequestUri(projectKey: string, version: string, routePath: string): string {
  return ['', projectKey, `v${version}`, ...(routePath ? routePath.split('/') : [])].map(encodeURIComponent).join('/')
}

function findAppropriateVersion(projectVersions: ProjectVersion[], rawVersion: string): UriData['version'] | undefined {
  if (isInexactVersion(rawVersion)) {
    const requestedRange = { start: rawVersion, end: versionUtil.getNextVersion(rawVersion) }
    if (requestedRange.end) {
      // The versions inside the project are expected to be listed in ascending order, and we prefer the latest versions
      for (let i = projectVersions.length - 1; i >= 0; --i) {
        if (versionUtil.doVersionRangesIntersect(projectVersions[i].versionRange, requestedRange)) {
          return {
            ...projectVersions[i],
            requestedType: 'inexact',
            requestedRange,
          }
        }
      }
    }
  } else if (versionUtil.isSemVerVersion(rawVersion)) {
    // The versions inside the project are expected to be listed in ascending order, and we prefer the latest versions
    for (let i = projectVersions.length - 1; i >= 0; --i) {
      if (versionUtil.isVersionInRange(projectVersions[i].versionRange, rawVersion)) {
        return {
          ...projectVersions[i],
          requestedType: 'exact',
          requestedVersion: rawVersion,
        }
      }
    }
  }

  return undefined
}

function isInexactVersion(rawVersion: string) {
  return /^(0|[1-9]\d*)(\.(0|[1-9]\d*))?$/.test(rawVersion)
}
