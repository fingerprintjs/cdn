import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as rollup from 'rollup'
import { nodeResolve as rollupNodeResolve } from '@rollup/plugin-node-resolve'
import { terser as terserPlugin } from 'rollup-plugin-terser'

interface Options {
  /** The absolute path of the directory that holds the package to bundle. There must by package.json in the root. */
  packageDirectory: string
  /** The absolut path of a node_modules directory available during bundling. */
  nodeModulesDirectory?: string | undefined
  format: rollup.ModuleFormat
  globalVariableName: string
  minify?: boolean | undefined
}

/**
 * Makes a JS bundle (a single script file) from the given NPM package
 */
export default function buildBundle({
  packageDirectory,
  nodeModulesDirectory,
  format,
  globalVariableName,
  minify,
}: Options): Promise<string> {
  // todo: Include the banner from the original file
  return withSandbox(packageDirectory, nodeModulesDirectory, async (sandboxDirectory, packageDirectory) => {
    const entrypoint = await getPackageModulePath(packageDirectory)
    const bundle = await rollup.rollup({
      input: entrypoint,
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
  })
}

/**
 * Creates a temporary directory and symlinks the package and the node modules into it.
 * Removes the directory after the action completes.
 */
async function withSandbox<T>(
  packageDirectory: string,
  nodeModulesDirectory: string | undefined,
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

  await fs.mkdir(sandboxDirectory, { recursive: true })

  try {
    const packageSandboxDirectory = path.join(sandboxDirectory, 'package')

    await Promise.all([
      fs.symlink(packageDirectory, packageSandboxDirectory, 'dir'),
      nodeModulesDirectory === undefined
        ? undefined
        : fs.symlink(nodeModulesDirectory, path.join(sandboxDirectory, 'node_modules'), 'dir'),
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
