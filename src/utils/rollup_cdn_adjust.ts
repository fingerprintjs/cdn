import { Plugin } from 'rollup'

/**
 * Creates a Rollup plugin for CDN-specific transformations
 */
export default function rollupCdnAdjust(): Plugin {
  // Official guide: https://rollupjs.org/guide/en/#transformers
  // Plugin examples:
  // https://github.com/rollup/plugins/blob/master/packages/replace/src/index.js
  // https://github.com/se-panfilov/rollup-plugin-strip-code/blob/master/index.js
  return {
    name: 'cdnAdjust',

    transform(source, id) {
      return isThirdPartyLibrary(id) ? null : removeCodeSpecifiedBySource(source)
    },
  }
}

function isThirdPartyLibrary(id: string) {
  return id.includes('/node_modules/')
}

/* fpjs-cdn-remove-start */
/* fpjs-cdn-remove-end */
/**
 * Removes the code that stands between the special comments above
 */
function removeCodeSpecifiedBySource(code: string) {
  return code.replace(/\/\*\s*fpjs-cdn-remove-start\s*\*\/[\s\S]*?\/\*\s*fpjs-cdn-remove-end\s*\*\//g, '')
}
