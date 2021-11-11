import type { Plugin } from 'rollup'
import { escapeForRegex } from './regex'

interface Options {
  /**
   * The words to replace in the library distributive files. The keys are the targets, the values are the replacements
   * (inserted as is). When searching, the targets are expected to be surrounded by word boundaries (\b in regexps).
   */
  replacements?: Record<string, string> | undefined
}

/**
 * Creates a Rollup plugin for CDN-specific transformations
 */
export default function rollupCdnAdjust({ replacements }: Options = {}): Plugin {
  // Official guide: https://rollupjs.org/guide/en/#transformers
  // Inspired by: https://github.com/rollup/plugins/blob/master/packages/replace/src/index.js
  return {
    name: 'cdnAdjust',

    transform(source, id) {
      if (!replacements || Object.keys(replacements).length === 0 || isThirdPartyLibrary(id)) {
        return null
      }
      return replaceInCode(source, replacements)
    },
  }
}

function isThirdPartyLibrary(id: string) {
  return id.includes('/node_modules/')
}

function replaceInCode(code: string, replacements: Record<string, string>) {
  return code.replace(
    new RegExp(`(?<=\\W)(${Object.keys(replacements).map(escapeForRegex).join('|')})(?=\\W)`, 'g'),
    (key) => replacements[key],
  )
}
