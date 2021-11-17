import { promises as fs } from 'fs'
import * as path from 'path'
import { withTemporaryFile, withTemporaryFiles } from './utils/filesystem'
import buildBundle, { getCodeBanner, getPackageModulePath, withSandbox } from './bundler'

// These tests cover `buildCodeBody` too
describe('buildBundle', () => {
  it('builds unminified ESM, preserves banner and replaces', async () => {
    const packageFiles = {
      'package.json': '{"module": "index.js"}',
      'index.js': `/* Copyright John Doe 2021 */
import {__assign} from 'tslib'
export function test() {
  return __assign({foo: __FOO__}, {bar: __BAR__})
}`,
    }

    await withTemporaryFiles(packageFiles, async (packageDirectory) => {
      const result = await buildBundle({
        packageDirectory,
        nodeModules: ['tslib'],
        format: 'esm',
        globalVariableName: 'doesntmatter',
        replacements: {
          __FOO__: 'apple',
          __BAR__: 'pear',
        },
      })
      expect(result).toMatchSnapshot()
    })
  })

  it('builds minified IIFE and preserves banner', async () => {
    const packageFiles = {
      'package.json': '{"jsnext:main": "index.js"}',
      'index.js': `// Copyright John Doe 2021
import {__assign} from 'tslib'
export function test() {
  return __assign({foo: 'Phu'}, {bar: 'Baar'})
}`,
    }

    await withTemporaryFiles(packageFiles, async (packageDirectory) => {
      const result = await buildBundle({
        packageDirectory,
        nodeModules: ['tslib'],
        format: 'iife',
        globalVariableName: 'MyTest',
        minify: true,
      })
      expect(result).toMatchSnapshot()
    })
  })

  it('minifies and leave no blank first line if there is no banner', async () => {
    const packageFiles = {
      'package.json': '{"module": "index.js"}',
      'index.js': `export function test() { return {foo: 'Phu'} }`,
    }

    await withTemporaryFiles(packageFiles, async (packageDirectory) => {
      const result = await buildBundle({
        packageDirectory,
        nodeModules: ['tslib'],
        format: 'esm',
        globalVariableName: 'MyTest',
        minify: true,
      })
      expect(result).not.toMatch(/^[\r\n]/)
    })
  })
})

describe('withSandbox', () => {
  it('adds only the given modules', async () => {
    const packageFiles = {
      'package.json': '{"module":"ind.js"}',
      'ind.js': 'console.log("Hello")',
    }
    const nodeModules = ['tslib', 'rollup']

    await withTemporaryFiles(packageFiles, async (sourceDirectory) => {
      await withSandbox(sourceDirectory, nodeModules, async (sandboxDirectory, packageDirectory) => {
        expect((await fs.readdir(sandboxDirectory)).sort()).toEqual(
          [path.relative(sandboxDirectory, packageDirectory), 'node_modules'].sort(),
        )

        await Promise.all([
          ...Object.entries(packageFiles).map(([filePath, content]) =>
            expect(fs.readFile(path.join(packageDirectory, filePath), 'utf8')).resolves.toBe(content),
          ),

          expect(fs.readdir(path.join(sandboxDirectory, 'node_modules')).then((list) => list.sort())).resolves.toEqual(
            nodeModules.sort(),
          ),
          ...nodeModules.map((name) =>
            expect(
              fs.lstat(path.join(sandboxDirectory, 'node_modules', name, 'package.json')).then((stat) => stat.isFile()),
            ).resolves.toBe(true),
          ),
        ])
      })
    })
  })

  it('clears when complete', async () => {
    const packageFiles = {
      'package.json': '{"module":"ind.js"}',
      'ind.js': 'console.log("Hello")',
    }
    const nodeModules = ['tslib', 'rollup']

    await withTemporaryFiles(packageFiles, async (packageDirectory) => {
      let sandboxDirectory = ''
      await withSandbox(packageDirectory, nodeModules, (_sandboxDirectory) => {
        sandboxDirectory = _sandboxDirectory
        return new Promise((resolve) => setTimeout(resolve, 1))
      })
      // withSandbox removes after returns, so we need to wait until the files are removed
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(sandboxDirectory).not.toBe('')
      await Promise.all([
        expect(fs.lstat(sandboxDirectory)).rejects.toEqual(expect.objectContaining({ code: 'ENOENT' })),

        // Check that the original files are intact
        ...Object.entries(packageFiles).map(([filePath, content]) =>
          expect(fs.readFile(path.join(packageDirectory, filePath), 'utf8')).resolves.toBe(content),
        ),
        ...nodeModules.map((name) =>
          expect(
            fs.lstat(path.join(__dirname, '..', 'node_modules', name, 'package.json')).then((stat) => stat.isFile()),
          ).resolves.toBe(true),
        ),
      ])
    })
  })
})

describe('getPackageModulePath', () => {
  it('prefers "module"', async () => {
    const packageFiles = {
      'package.json': '{"module": "foo.js", "jsnext:main": "bar.js"}',
      'foo.js': 'console.log("Hello")',
      'bar.js': 'console.log("Hello")',
    }
    await withTemporaryFiles(packageFiles, async (packageDirectory) => {
      await expect(getPackageModulePath(packageDirectory)).resolves.toBe(path.join(packageDirectory, 'foo.js'))
    })
  })

  it('uses "jsnext:main" if there is no "module" field', async () => {
    const packageFiles = {
      'package.json': '{"jsnext:main": "bar.js"}',
      'bar.js': 'console.log("Hello")',
    }
    await withTemporaryFiles(packageFiles, async (packageDirectory) => {
      await expect(getPackageModulePath(packageDirectory)).resolves.toBe(path.join(packageDirectory, 'bar.js'))
    })
  })

  it('uses "jsnext:main" if there is no "module" file', async () => {
    const packageFiles = {
      'package.json': '{"module": "foo.js", "jsnext:main": "bar.js"}',
      'bar.js': 'console.log("Hello")',
    }
    await withTemporaryFiles(packageFiles, async (packageDirectory) => {
      await expect(getPackageModulePath(packageDirectory)).resolves.toBe(path.join(packageDirectory, 'bar.js'))
    })
  })

  it('throws "jsnext:main" if there is no entrypoint', async () => {
    const packageFiles = {
      'package.json': '{"module": "foo.js", "jsnext:main": "foo.js"}',
      'foo.js/foo.js': 'console.log("Hello")',
    }
    await withTemporaryFiles(packageFiles, async (packageDirectory) => {
      await expect(getPackageModulePath(packageDirectory)).rejects.toEqual(
        expect.objectContaining({ message: 'The package has no main module file' }),
      )
    })
  })
})

describe('getCodeBanner', () => {
  it('extracts the only banner', async () => {
    const code = `/*
 * Copyright John Doe
 */

console.log('Hello, world')`

    await withTemporaryFile(code, async (file) => {
      await expect(getCodeBanner(file)).resolves.toBe(`/*
 * Copyright John Doe
 */`)
    })
  })

  it('extracts only one banner (/* */ first)', async () => {
    const code = `
/*
 * Copyright John Doe
 */
// foo
console.log('Hello, world')`

    await withTemporaryFile(code, async (file) => {
      await expect(getCodeBanner(file)).resolves.toBe(`/*
 * Copyright John Doe
 */`)
    })
  })

  it('extracts only one banner (// first)', async () => {
    const code = `
//
  // Copyright John Doe
//2012-2021
//
/* foo */
console.log('Hello, world')`

    await withTemporaryFile(code, async (file) => {
      await expect(getCodeBanner(file)).resolves.toBe(`//
  // Copyright John Doe
//2012-2021
//`)
    })
  })

  it("doesn't go after code", async () => {
    const code = `console.log('Hello, world')
/*
 * Copyright John Doe
 */`

    await withTemporaryFile(code, async (file) => {
      await expect(getCodeBanner(file)).resolves.toBe('')
    })
  })
})
