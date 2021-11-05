/* eslint-disable no-console */
/*
 * This scripts builds the distributive files
 */

import * as path from 'path'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import * as fsExtra from 'fs-extra'
import * as rollup from 'rollup'

// `import ... from ...` doesn't work here for some reason
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rollupTypescript = require('@rollup/plugin-typescript')

const projectRootDirectory = path.join(__dirname, '..')
const distDirectory = path.join(projectRootDirectory, 'dist')

async function prepareDistDirectory() {
  await fs.rm(distDirectory, { recursive: true, force: true })
  await fs.mkdir(distDirectory, { recursive: true })
}

async function buildLambda() {
  const lambdaBundle = await rollup.rollup({
    input: path.join(projectRootDirectory, 'src', 'index.ts'),
    external: (id) => /^[^./]/.test(id), // Don't bundle node modules in
    plugins: [
      /*rollupNodeResolve({
        preferBuiltins: true,
      }),
      rollupCommonJs(),
      rollupJson(),*/
      rollupTypescript({
        declaration: false,
      }),
    ],
  })
  await lambdaBundle.write({
    dir: distDirectory,
    format: 'cjs',
    generatedCode: 'es2015',
    banner: '/*\n * The code was generated automatically from https://github.com/fingerprintjs/cdn\n */',
  })
}

async function copyNodeModulesForLambda() {
  await Promise.all([
    fs.cp(path.join(projectRootDirectory, 'package.json'), path.join(distDirectory, 'package.json')),
    fs.cp(path.join(projectRootDirectory, 'yarn.lock'), path.join(distDirectory, 'yarn.lock')),
    fsExtra.copy(path.join(projectRootDirectory, 'node_modules'), path.join(distDirectory, 'node_modules')),
  ])
  // Yarn just removes the excess Node modules
  await promisify(exec)(`yarn install --production`, {
    cwd: distDirectory,
  })
  await Promise.all([fs.rm(path.join(distDirectory, 'package.json')), fs.rm(path.join(distDirectory, 'yarn.lock'))])
}

async function build() {
  try {
    await prepareDistDirectory()
    await Promise.all([buildLambda(), copyNodeModulesForLambda()])
  } catch (error) {
    // Don't make a broken distributive directory
    await fs.rm(distDirectory, { recursive: true, force: true })
    throw error
  }
}

build().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exitCode = 1
})
