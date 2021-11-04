/*
 * This scripts builds the distributive files
 */

import * as path from 'path'
import { promises as fs } from 'fs'
import * as fsExtra from 'fs-extra'
import * as rollup from 'rollup'
import { nodeResolve as rollupNodeResolve } from '@rollup/plugin-node-resolve'

// `import ... from ...` doesn't work here for some reason
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rollupTypescript = require('@rollup/plugin-typescript')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rollupCommonJs = require('@rollup/plugin-commonjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rollupJson = require('@rollup/plugin-json')

const distDirectory = path.join(__dirname, '..', 'dist')
const nodeModulesForLambdaBundler = ['tslib']

async function prepareDistDirectory() {
  await fs.rm(distDirectory, { recursive: true, force: true })
  await fs.mkdir(distDirectory, { recursive: true })
}

async function buildLambda() {
  // Embedding all the dependencies into the bundle to remove the unused code that Node.js would load
  const lambdaBundle = await rollup.rollup({
    input: path.join(__dirname, '..', 'src', 'lambda.ts'),
    plugins: [
      rollupNodeResolve({
        preferBuiltins: true,
      }),
      rollupCommonJs(),
      rollupJson(),
      rollupTypescript({
        declaration: false,
      }),
    ],
  })
  await lambdaBundle.write({
    file: path.join(distDirectory, 'index.js'),
    format: 'cjs',
    banner: '/*\n * The code was generated automatically from https://github.com/fingerprintjs/cdn\n */',
  })
}

async function copyNodeModulesForLambdaBundler() {
  await Promise.all(
    nodeModulesForLambdaBundler.map((name) =>
      fsExtra.copy(
        path.join(__dirname, '..', 'node_modules', ...name.split('/')),
        path.join(distDirectory, 'node_modules', ...name.split('/')),
      ),
    ),
  )
}

async function build() {
  try {
    await prepareDistDirectory()
    await Promise.all([buildLambda(), copyNodeModulesForLambdaBundler()])
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
