import { Plugin, TransformHook, TransformPluginContext } from 'rollup'
import rollupCdnAdjust from './rollup_cdn_adjust'

const mockCode = `import * as foo from 'bar'

if (window.__fpjs_d_m) {
  return
}

if ([TEST] === 'baz') {
  foo.goBar(NAME)
} else {
  foo.goHome(NAMES, name)
}`

const mockPluginContext = {} as TransformPluginContext

function callPluginTransform(plugin: Plugin, ...args: Parameters<TransformHook>) {
  const transform = plugin.transform
  if (typeof transform === 'function') {
    return transform.apply(mockPluginContext, args)
  }
  throw new Error('plugin.transform is not a function')
}

it('does nothing when there are no replacements', () => {
  expect(callPluginTransform(rollupCdnAdjust(), mockCode, '/project/index.js')).toBeNull()
  expect(callPluginTransform(rollupCdnAdjust({}), mockCode, '/project/index.js')).toBeNull()
  expect(callPluginTransform(rollupCdnAdjust({ replacements: {} }), mockCode, '/project/index.js')).toBeNull()
})

it('does nothing when the file is a Node module', () => {
  expect(
    callPluginTransform(
      rollupCdnAdjust({ replacements: { '[TEST]': 'true' } }),
      mockCode,
      '/project/node_modules/foo/index.js',
    ),
  ).toBeNull()
})

it('replaces proper keywords', () => {
  expect(
    callPluginTransform(
      rollupCdnAdjust({
        replacements: {
          '[TEST]': 'test()',
          NAME: '"Bang"',
          'window.__fpjs_d_m': 'false',
        },
      }),
      mockCode,
      '/index.js',
    ),
  ).toBe(`import * as foo from 'bar'

if (false) {
  return
}

if (test() === 'baz') {
  foo.goBar("Bang")
} else {
  foo.goHome(NAMES, name)
}`)
})
