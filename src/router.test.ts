import { projects } from './projects'
import { makeRequestUri, parseRequestUri } from './router'

describe('parseRequestUri', () => {
  it('parses exact version', () => {
    expect(parseRequestUri('/fingerprintjs/v3.3.0/esm.min.js')).toEqual({
      project: { ...projects.fingerprintjs, key: 'fingerprintjs' },
      version: { ...projects.fingerprintjs.versions[0], requestedType: 'exact', requestedVersion: '3.3.0' },
      route: { ...projects.fingerprintjs.versions[0].routes['esm.min.js'], path: 'esm.min.js' },
    })
  })

  it('parses inexact version', () => {
    expect(parseRequestUri('/fingerprintjs/v3.3/esm.js')).toEqual({
      project: { ...projects.fingerprintjs, key: 'fingerprintjs' },
      version: {
        ...projects.fingerprintjs.versions[0],
        requestedType: 'inexact',
        requestedRange: { start: '3.3', end: '3.4' },
      },
      route: { ...projects.fingerprintjs.versions[0].routes['esm.js'], path: 'esm.js' },
    })
  })

  it('parses null route', () => {
    expect(parseRequestUri('/botd/v0')).toEqual({
      project: { ...projects.botd, key: 'botd' },
      version: {
        ...projects.botd.versions[0],
        requestedType: 'inexact',
        requestedRange: { start: '0', end: '1' },
      },
      route: { ...projects.botd.versions[0].routes[''], path: '' },
    })
  })

  it('parses missing route', () => {
    expect(parseRequestUri('/fingerprintjs/v3.3.0/foo')).toBeUndefined()
  })

  it('parses missing version', () => {
    expect(parseRequestUri('/fingerprintjs/v2/esm.min.js')).toBeUndefined()
  })

  it('parses excluded version', () => {
    expect(parseRequestUri('/botd/v0.1.16/esm.min.js')).toBeUndefined()
  })

  it('parses missing project', () => {
    expect(parseRequestUri('/foo/v2/esm.min.js')).toBeUndefined()
  })

  it('parses incorrect URL', () => {
    expect(parseRequestUri('/no/resource/here')).toBeUndefined()
  })

  it('parses URL-encoded route', () => {
    const url = '/botd/v0/esm.js'
      .split('/')
      .map((part) =>
        part
          .split('')
          .map((char) => (char === 'v' ? char : `%${char.charCodeAt(0).toString(16).toUpperCase()}`))
          .join(''),
      )
      .join('/')

    expect(parseRequestUri(url)).toEqual({
      project: { ...projects.botd, key: 'botd' },
      version: {
        ...projects.botd.versions[0],
        requestedType: 'inexact',
        requestedRange: { start: '0', end: '1' },
      },
      route: { ...projects.botd.versions[0].routes['esm.js'], path: 'esm.js' },
    })
  })
})

describe('makeRequestUri', () => {
  it('makes for filled route', () => {
    expect(makeRequestUri('fingerprintjs', '3.2.1', 'iife.js')).toBe('/fingerprintjs/v3.2.1/iife.js')
  })

  it('makes for null route', () => {
    expect(makeRequestUri('fingerprintjs', '3.2.1', '')).toBe('/fingerprintjs/v3.2.1')
  })

  it('handles URL-unfriendly names', () => {
    expect(makeRequestUri('finger print', '1/2', '@a/@b')).toBe('/finger%20print/v1%2F2/%40a/%40b')
  })
})
