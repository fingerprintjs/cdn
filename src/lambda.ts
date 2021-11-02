import * as stream from 'stream'
import * as zlib from 'zlib'
import * as os from 'os'
import * as path from 'path'
import { promises as fs } from 'fs'
import { promisify } from 'util'
import { CloudFrontRequestHandler } from 'aws-lambda'
import got from 'got'
import * as tar from 'tar-fs'

export const handler: CloudFrontRequestHandler = async () => {
  const mainScript = await getPackageMainScript('@fingerprintjs/fingerprintjs', '3.3.0')
  const now = new Date()
  return {
    status: '200',
    headers: {
      'content-type': [{ value: 'application/javascript; charset=utf-8' }],
      'cache-control': [{ value: 'public, max-age=31536000' }],
      'last-modified': [{ value: now.toUTCString() }],
    },
    body: mainScript,
  }
}

/*
function parseRequestUri(uri: string): {project: Project, version: ProjectVersion, route: ProjectRoute} | undefined {
  for (const [projectPath, project] of Object.entries(projects)) {
    if (!uri.startsWith(`/${projectPath}/`)) {
      continue
    }

    const versionsAndRoute = /v([^/]+)\/(.*)/.exec(uri.slice(projectPath.length + 2))
    if (versionsAndPath) {
      const [, versionString, routeString]
    }
  }

  return undefined
}
*/

async function getPackageMainScript(name: string, version: string): Promise<string> {
  const packageDirectory = await downloadPackage(name, version)
  const packageJsonContent = await fs.readFile(path.join(packageDirectory, 'package', 'package.json'), 'utf8')
  const packageDescription = JSON.parse(packageJsonContent)

  for (const relativePath of [packageDescription.module, packageDescription.main]) {
    const fullPath = path.join(packageDirectory, 'package', ...relativePath.split('/'))
    try {
      return await fs.readFile(fullPath, 'utf8')
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT' || // Means that the file doesn't exist
        (error as NodeJS.ErrnoException).code === 'EISDIR' // Means that the path is a directory
      ) {
        continue
      }
      throw error
    }
  }

  throw new Error('The package has no main file')
}

async function downloadPackage(name: string, version: string) {
  const directory = getPackageDirectory(name, version)

  await promisify(stream.pipeline)(
    got.stream(getPackageUrl(name, version)),
    zlib.createGunzip(),
    tar.extract(directory, {
      strict: false,
      readable: true,
      writable: true,
      ignore: (_, header) => !(header?.type === 'file' || header?.type === 'directory'),
    }),
  )

  return directory
}

function getPackageUrl(name: string, version: string, registryUrl = 'https://registry.npmjs.org') {
  const scopelessName = name.startsWith('@') ? name.split('/', 2)[1] : name
  return `${registryUrl}/${name}/-/${scopelessName}-${version}.tgz`
}

function getPackageDirectory(name: string, version: string): string {
  return path.join(os.tmpdir(), 'npm', ...name.split('/'), `@${version}`)
}
