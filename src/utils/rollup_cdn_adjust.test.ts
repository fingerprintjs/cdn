import { TransformPluginContext } from 'rollup'
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

it('does nothing when there are no replacements', () => {
  expect(rollupCdnAdjust().transform?.call(mockPluginContext, mockCode, '/project/index.js')).toBeNull()
  expect(rollupCdnAdjust({}).transform?.call(mockPluginContext, mockCode, '/project/index.js')).toBeNull()
  expect(
    rollupCdnAdjust({ replacements: {} }).transform?.call(mockPluginContext, mockCode, '/project/index.js'),
  ).toBeNull()
})

it('does nothing when the file is a Node module', () => {
  expect(
    rollupCdnAdjust({ replacements: { '[TEST]': 'true' } }).transform?.call(
      mockPluginContext,
      mockCode,
      '/project/node_modules/foo/index.js',
    ),
  ).toBeNull()
})

it('replaces proper keywords', () => {
  expect(
    rollupCdnAdjust({
      replacements: { '[TEST]': 'test()', NAME: '"Bang"', 'window.__fpjs_d_m': 'false' },
    }).transform?.call(mockPluginContext, mockCode, '/index.js'),
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
