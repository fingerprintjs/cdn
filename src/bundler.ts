import { createReadStream, promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as rollup from 'rollup'
import { nodeResolve as rollupNodeResolve } from '@rollup/plugin-node-resolve'
import { terser as terserPlugin } from 'rollup-plugin-terser'

interface Options {
  /** The absolute path of the directory that holds the package to bundle. There must by package.json in the root. */
  packageDirectory: string
  /** Names of Node modules (from the node_modules directory) available during bundling. */
  nodeModules?: string[]
  format: rollup.ModuleFormat
  globalVariableName: string
  minify?: boolean | undefined
}

/**
 * Makes a JS bundle (a single script file) from the given NPM package
 */
export default function buildBundle({
  packageDirectory,
  nodeModules = [],
  format,
  globalVariableName,
  minify,
}: Options): Promise<string> {
  return withSandbox(packageDirectory, nodeModules, async (sandboxDirectory, packageDirectory) => {
    const entrypoint = await getPackageModulePath(packageDirectory)
    const [codeBody, codeBanner] = await Promise.all([
      buildCodeBody(sandboxDirectory, entrypoint, format, globalVariableName, minify),
      getCodeBanner(entrypoint),
    ])
    return `${codeBanner}${codeBanner && '\n'}${codeBody}`
  })
}

/**
 * Creates a temporary directory and symlinks the package and the node modules into it.
 * Removes the directory after the action completes.
 */
async function withSandbox<T>(
  packageDirectory: string,
  nodeModules: string[],
  action: (sandboxDirectory: string, packageDirectory: string) => Promise<T> | T,
) {
  let sandboxDirectory: string
  for (;;) {
    sandboxDirectory = path.join(os.tmpdir(), `fpjs-${Math.random()}`)
    try {
      await fs.lstat(sandboxDirectory)
    } catch (error) {
      // Means that the directory doesn't exist, so we can make a directory here
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        break
      }
      throw error
    }
  }

  try {
    await fs.mkdir(path.join(sandboxDirectory, 'node_modules'), { recursive: true })
    const packageSandboxDirectory = path.join(sandboxDirectory, 'package')

    await Promise.all([
      fs.symlink(packageDirectory, packageSandboxDirectory, 'dir'),
      ...nodeModules.map((name) => {
        const moduleSubdir = path.join('node_modules', ...name.split('/'))
        return fs.symlink(path.join(__dirname, '..', moduleSubdir), path.join(sandboxDirectory, moduleSubdir), 'dir')
      }),
    ])

    return await action(sandboxDirectory, packageSandboxDirectory)
  } finally {
    void fs.rm(sandboxDirectory, { recursive: true, force: true })
  }
}

/**
 * Gets the entry point module file of the NPM package
 */
async function getPackageModulePath(packageDirectory: string): Promise<string> {
  const packageJsonContent = await fs.readFile(path.join(packageDirectory, 'package.json'), 'utf8')
  const packageDescription = JSON.parse(packageJsonContent)

  for (const prop of ['module', 'jsnext:main']) {
    if (typeof packageDescription[prop] !== 'string') {
      continue
    }
    const fullPath = path.join(packageDirectory, ...packageDescription[prop].split('/'))
    try {
      const fileInfo = await fs.lstat(fullPath)
      if (fileInfo.isFile()) {
        return fullPath
      }
    } catch (error) {
      // Means that the file doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      throw error
    }
  }

  throw new Error('The package has no main module file')
}

async function buildCodeBody(
  sandboxDirectory: string,
  entryFilePath: string,
  format: rollup.ModuleFormat,
  globalVariableName: string,
  minify?: boolean,
): Promise<string> {
  const bundle = await rollup.rollup({
    input: entryFilePath,
    preserveSymlinks: true, // To prevent going outside the sandbox
    plugins: [
      rollupNodeResolve({
        browser: true,
        rootDir: sandboxDirectory,
        jail: sandboxDirectory,
      }),
    ],
  })
  const { output } = await bundle.generate({
    name: globalVariableName,
    exports: 'named',
    format,
    plugins: [
      minify &&
        terserPlugin({
          format: {
            comments: false,
          },
          safari10: true,
        }),
    ],
  })
  return output[0].code
}

async function getCodeBanner(filePath: string) {
  let fileContent = ''
  const maxBannerLength = 1024
  const readStream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: maxBannerLength })

  try {
    await new Promise<void>((resolve, reject) => {
      readStream.on('data', (chunk) => {
        fileContent += chunk
        if (fileContent.length >= maxBannerLength) {
          fileContent = fileContent.slice(0, maxBannerLength)
          resolve()
        }
      })
      readStream.on('error', reject)
    })
  } finally {
    readStream.close()
  }

  // The expression matches either a group of //-comments with no empty lines in between, or a /**/ comment.
  // The comments are expected to stand at the start of the file.
  const bannerMatch = /^\s*(\/\*[\s\S]*?\*\/|((^|\r\n|\r|\n)[ \t]*\/\/.*)+)/.exec(fileContent)
  return bannerMatch ? bannerMatch[1] : ''
}
