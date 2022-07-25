import { ProjectRoute, ProjectRouteAlias, projects, ProjectVersion } from './projects'
import * as versionUtil from './utils/version'

export interface ExactVersion extends ProjectVersion {
  requestedType: 'exact'
  requestedVersion: string
}

export interface InexactVersion extends ProjectVersion {
  requestedType: 'inexact'
  requestedRange: versionUtil.VersionRange
}

export type ProjectNoAliasRoute = Exclude<ProjectRoute, ProjectRouteAlias>

export interface UriData {
  version: ExactVersion | InexactVersion
  route: ProjectNoAliasRoute
}

/**
 * Parses a URI of an incoming request.
 * The URI is expected to always start with a slash.
 */
export function parseRequestUri(uri: string): UriData | undefined {
  try {
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
    let route = version.routes[routePath]
    route = resolveAlias(version, route)

    return { version, route }
  } catch (error) {
    if (isUrlDecodeError(error)) {
      return undefined
    }
    throw error
  }
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
      if (
        versionUtil.isVersionInRange(projectVersions[i].versionRange, rawVersion) &&
        !projectVersions[i].excludeVersions?.includes(rawVersion)
      ) {
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

/**
 * Detects whether the error is thrown by decodeURIComponent in response to an improper URI
 */
function isUrlDecodeError(error: unknown): error is URIError {
  return error instanceof URIError
}

function resolveAlias(version: ProjectVersion, route: ProjectRoute): ProjectNoAliasRoute {
  let currentRoute = route

  for (;;) {
    if (currentRoute.type !== 'alias') {
      return currentRoute
    }

    const { target } = currentRoute
    currentRoute = version.routes[target]

    if (!currentRoute) {
      throw new Error(`Configuration error: an alias points to a non-existent route ${JSON.stringify(target)}`)
    }
    if (currentRoute === route) {
      throw new Error(`Configuration error: an alias cycle is detected at ${JSON.stringify(target)}`)
    }
  }
}
