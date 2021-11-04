import { Project, ProjectRoute, projects, ProjectVersion } from './projects'
import { doesVersionMatch } from './utils/version'

export interface UriData {
  project: Project & { key: string }
  version: ProjectVersion & { requestedType: 'exact' | 'vague'; requestedVersion: string }
  route: ProjectRoute & { path: string }
}

/**
 * Parses a URI of an incoming request.
 * The URI is expected to always start with a slash.
 */
export function parseRequestUri(uri: string): UriData | undefined {
  const uriMatches = /^\/([^/]*)\/v([^/]*)(?:\/(.+))?$/.exec(uri)
  if (!uriMatches) {
    return undefined
  }
  const [, projectKey, rawVersion, routePath = ''] = uriMatches

  if (!Object.prototype.hasOwnProperty.call(projects, projectKey)) {
    return undefined
  }
  const project = projects[projectKey]
  const isVagueVersion = /^\d+(\.\d+)?$/.test(rawVersion)
  let version: ProjectVersion | undefined

  // The versions inside the project are expected to be listed in ascending order, and we prefer the latest versions
  for (let i = project.versions.length - 1; i >= 0; --i) {
    const { startVersion, endVersion } = project.versions[i]
    if (
      (startVersion === undefined || doesVersionMatch(startVersion, rawVersion)) &&
      (endVersion === undefined || !doesVersionMatch(endVersion, rawVersion))
    ) {
      version = project.versions[i]
      break
    }
  }

  if (!version) {
    return undefined
  }

  if (!Object.prototype.hasOwnProperty.call(version.routes, routePath)) {
    return undefined
  }
  const route = version.routes[routePath]

  return {
    project: { ...project, key: projectKey },
    version: { ...version, requestedType: isVagueVersion ? 'vague' : 'exact', requestedVersion: rawVersion },
    route: { ...route, path: routePath },
  }
}

/**
 * Builds the URI of an incoming request (e.g. for redirect).
 * The returned URI starts with a slash.
 */
export function makeRequestUri(projectKey: string, version: string, routePath: string): string {
  return `/${projectKey}/v${version}${routePath && `/${routePath}`}`
}
