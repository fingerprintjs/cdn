import { promises as fs } from 'fs'
import * as path from 'path'
import * as rollup from 'rollup'
import { nodeResolve as rollupNodeResolve } from '@rollup/plugin-node-resolve'
import { terser as terserPlugin } from 'rollup-plugin-terser'
import { makeTemporaryDirectory, readFirstCharacters } from './utils/filesystem'
import rollupCdnAdjust from './utils/rollup_cdn_adjust'

interface Options {
  /** The absolute path of the directory that holds the package to bundle. There must by package.json in the root. */
  packageDirectory: string
  /** Names of Node modules (from the node_modules directory) available during bundling. */
  nodeModules?: string[]
  format: rollup.ModuleFormat
  globalVariableName: string
  minify?: boolean | undefined
  /** @see rollupCdnAdjust */
  replacements?: Record<string, string> | undefined
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
  replacements,
}: Options): Promise<string> {
  return withSandbox(packageDirectory, nodeModules, async (sandboxDirectory, packageDirectory) => {
    const entrypoint = await getPackageModulePath(packageDirectory)
    const [codeBody, codeBanner] = await Promise.all([
      buildCodeBody(sandboxDirectory, entrypoint, format, globalVariableName, minify, replacements),
      getCodeBanner(entrypoint),
    ])
    return `${codeBanner}${codeBanner && '\n'}${codeBody}`
  })
}

/**
 * Creates a temporary directory and symlinks the package and the node modules into it.
 * Removes the directory after the action completes.
 *
 * @internal Exported only for the tests
 */
export async function withSandbox<T>(
  packageDirectory: string,
  nodeModules: string[],
  action: (sandboxDirectory: string, packageDirectory: string) => Promise<T> | T,
) {
  const sandboxDirectory = await makeTemporaryDirectory()

  try {
    const rootDirectory = path.join(__dirname, '..')
    const packageSandboxDirectory = path.join(sandboxDirectory, 'package')

    await Promise.all([
      fs.symlink(packageDirectory, packageSandboxDirectory, 'dir'),
      fs.mkdir(path.join(sandboxDirectory, 'node_modules')).then(() =>
        Promise.all(
          nodeModules.map((name) => {
            const moduleSubdir = path.join('node_modules', ...name.split('/'))
            return fs.symlink(path.join(rootDirectory, moduleSubdir), path.join(sandboxDirectory, moduleSubdir), 'dir')
          }),
        ),
      ),
    ])

    return await action(sandboxDirectory, packageSandboxDirectory)
  } finally {
    void fs.rm(sandboxDirectory, { recursive: true, force: true })
  }
}

/**
 * Gets the entry point module file of the NPM
 *
 * @internal Exported only for the tests
 */
export async function getPackageModulePath(packageDirectory: string): Promise<string> {
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

/**
 * Builds the JS code from the given entry file
 *
 * @internal Exported only for the tests
 */
export async function buildCodeBody(
  sandboxDirectory: string,
  entryFilePath: string,
  format: rollup.ModuleFormat,
  globalVariableName: string,
  minify?: boolean,
  replacements?: Record<string, string>,
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
      rollupCdnAdjust({ replacements }),
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

/**
 * Extracts the copyright comment from the JS file
 *
 * @internal Exported only for the tests
 */
export async function getCodeBanner(filePath: string) {
  const fileContent = await readFirstCharacters(filePath, 1024)

  // The expression matches either a group of //-comments with no empty lines in between, or a /**/ comment.
  // The comments are expected to stand at the start of the file.
  const bannerMatch = /^\s*(\/\*[\s\S]*?\*\/|((^|\r\n|\r|\n)[ \t]*\/\/.*)+)/.exec(fileContent)
  return bannerMatch ? bannerMatch[1].trim() : ''
}
