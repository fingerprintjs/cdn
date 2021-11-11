import {
  compareVersions,
  doVersionRangesIntersect,
  getNextVersion,
  intersectVersionRanges,
  isSemVerVersion,
  isStableVersion,
  isVersionInRange,
} from './version'

it('compares versions', () => {
  expect(compareVersions('3.2.1', '3.3.0')).toBe(-1)
  expect(compareVersions('3.2.1', '1.2.3')).toBe(1)
  expect(compareVersions('3.2.1', '3.2.0')).toBe(1)
  expect(compareVersions('1.2.4', '1.2.4')).toBe(0)
  expect(compareVersions('3', '3.0.0')).toBe(0)
  expect(compareVersions('3.0.0', '03.0')).toBe(0)
  expect(compareVersions('3', '3.3')).toBe(-1)
  expect(compareVersions('3.6.7', '4')).toBe(-1)
  expect(compareVersions('1.foo.0', '1.2')).toBe(1)
  expect(compareVersions('3.0-dev.2', '3.0-dev.3')).toBe(-1)
  expect(compareVersions('0.0.0.0.0.0.1', '0.0.0.0.0.1')).toBe(-1)
})

it('checks that version is in range', () => {
  expect(isVersionInRange({ start: '2.1.3', end: '2.2' }, '2.1.5')).toBe(true)
  expect(isVersionInRange({ start: '1.8', end: '2.7' }, '1.7.324')).toBe(false)
  expect(isVersionInRange({ start: '1.8', end: '2.7' }, '1.8.0')).toBe(true)
  expect(isVersionInRange({ start: '1.8.0', end: '2.7' }, '1.8')).toBe(true)
  expect(isVersionInRange({ start: '1.8', end: '2.7' }, '2.7.0')).toBe(false)
  expect(isVersionInRange({ start: '1.8', end: '2.7.0' }, '2.7')).toBe(false)
  expect(isVersionInRange({ start: '1.8', end: '2.7' }, '2.7.0.1')).toBe(false)

  expect(isVersionInRange({ start: '2.1.3' }, '38.4.3')).toBe(true)
  expect(isVersionInRange({ start: '2.1.3' }, '2.1.2')).toBe(false)

  expect(isVersionInRange({ end: '2.2' }, '0.0.1')).toBe(true)
  expect(isVersionInRange({ end: '2.2' }, '2.2.0')).toBe(false)

  expect(isVersionInRange({}, '1.2.3')).toBe(true)
})

it('checks that version ranges intersect', () => {
  expect(doVersionRangesIntersect({ start: '1.2', end: '2.1' }, { start: '1.3', end: '2.2' })).toBe(true)
  expect(doVersionRangesIntersect({ start: '1.2', end: '2.1' }, { start: '1.1', end: '2.0' })).toBe(true)
  expect(doVersionRangesIntersect({ start: '1.2', end: '2.1' }, { start: '1', end: '1.2' })).toBe(false)
  expect(doVersionRangesIntersect({ start: '1.2', end: '2.1' }, { start: '1.3', end: '2.2' })).toBe(true)

  expect(doVersionRangesIntersect({ start: '1.2', end: '2.1' }, { end: '3.5' })).toBe(true)
  expect(doVersionRangesIntersect({ end: '3.5' }, { start: '1.2', end: '2.1' })).toBe(true)
  expect(doVersionRangesIntersect({ end: '2.1' }, { start: '0.1', end: '1.2' })).toBe(true)
  expect(doVersionRangesIntersect({ start: '0.1', end: '1.2' }, { end: '2.1' })).toBe(true)

  expect(doVersionRangesIntersect({ start: '3.1' }, { end: '3.1' })).toBe(false)
  expect(doVersionRangesIntersect({ end: '3.1' }, { start: '3.1' })).toBe(false)
  expect(doVersionRangesIntersect({ start: '2.5' }, { end: '2.6' })).toBe(true)

  expect(doVersionRangesIntersect({ start: '1.2', end: '2.1' }, {})).toBe(true)
  expect(doVersionRangesIntersect({}, { start: '1.2', end: '2.1' })).toBe(true)
  expect(doVersionRangesIntersect({}, {})).toBe(true)
})

it('applies conjunction to version ranges', () => {
  const int = intersectVersionRanges

  expect(int({ start: '1.2', end: '2.1' }, { start: '1.3', end: '2.2' })).toEqual({ start: '1.3', end: '2.1' })
  expect(int({ start: '3.0.1', end: '3.5' }, { start: '2.9.1', end: '3.2' })).toEqual({ start: '3.0.1', end: '3.2' })
  expect(int({ start: '3', end: '4' }, { start: '3.3', end: '3.4' })).toEqual({ start: '3.3', end: '3.4' })

  expect(int({ start: '1.2' }, { end: '2.2' })).toEqual({ start: '1.2', end: '2.2' })
  expect(int({ start: '1.2' }, { start: '3.1' })).toEqual({ start: '3.1' })
  expect(int({ end: '1.2' }, { end: '3.1' })).toEqual({ end: '1.2' })
  expect(int({}, { start: '0.7.1', end: '1.2' }, {})).toEqual({ start: '0.7.1', end: '1.2' })
  expect(int({}, {}, {})).toEqual({})
})

it('gets next version', () => {
  expect(getNextVersion('1')).toBe('2')
  expect(getNextVersion('1.3')).toBe('1.4')
  expect(getNextVersion('1.3.0')).toBe('1.3.1')
  expect(getNextVersion('1.3.0-dev.5')).toBe('1.3.0-dev.6')
  expect(getNextVersion('1.3.0.foo')).toBeUndefined()
})

it('checks that version is stable', () => {
  expect(isStableVersion('1')).toBe(true)
  expect(isStableVersion('1.3')).toBe(true)
  expect(isStableVersion('1.3.0')).toBe(true)
  expect(isStableVersion('1.3.0-dev.5')).toBe(false)
})

it('checks that version follows SemVer', () => {
  expect(isSemVerVersion('1')).toBe(false)
  expect(isSemVerVersion('1.3')).toBe(false)
  expect(isSemVerVersion('1.3.0')).toBe(true)
  expect(isSemVerVersion('1.3.0-dev.5')).toBe(true)
  expect(isSemVerVersion('1.3.0+meta')).toBe(true)
  expect(isSemVerVersion('i/will/hack/you')).toBe(false)
})
