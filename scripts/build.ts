/* eslint-disable no-console */
/*
 * This scripts builds the distributive files
 */

import * as path from 'path'
import { promises as fs } from 'fs'
import { spawn, SpawnOptions } from 'child_process'
import * as fsExtra from 'fs-extra'

const projectRootDirectory = path.join(__dirname, '..')
const distDirectory = path.join(projectRootDirectory, 'dist')

async function prepareDistDirectory() {
  await fs.rm(distDirectory, { recursive: true, force: true })
  await fs.mkdir(distDirectory, { recursive: true })
}

async function buildLambda() {
  await runCommand('./node_modules/.bin/tsc')
}

async function copyNodeModulesForLambda() {
  await Promise.all([
    fs.copyFile(path.join(projectRootDirectory, 'package.json'), path.join(distDirectory, 'package.json')),
    fs.copyFile(path.join(projectRootDirectory, 'yarn.lock'), path.join(distDirectory, 'yarn.lock')),

    // We will use fs.cp when GitHub Actions support Node.js 16
    fsExtra.copy(path.join(projectRootDirectory, 'node_modules'), path.join(distDirectory, 'node_modules')),
  ])
  // Yarn just removes the excess Node modules
  await runCommand('yarn install', ['--production'], {
    cwd: distDirectory,
    shell: true,
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

function runCommand(command: string, args: string[] = [], options: SpawnOptions = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, options)
    child.stdout?.pipe(process.stdout)
    child.stderr?.pipe(process.stderr)
    child.on('error', reject)
    child.on('close', (code) => {
      if (code) {
        reject(new Error(`The ${command} command has exited with code ${code}`))
      } else {
        resolve()
      }
    })
  })
}

build().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exitCode = 1
})
