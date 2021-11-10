export interface VersionRange {
  /** The start version of the range. It's included. If it's undefined, there is no down limit. E.g. '3.2.1' */
  start?: string | undefined
  /** The end version of the range. It is not included. If it's undefined, there is no up limit. */
  end?: string | undefined
}

/**
 * Compares version strings.
 * Returns:
 * -1 - the first version is lower than the second version
 *  0 - the versions are equal
 *  1 - the first version is greater than the second version
 */
export function compareVersions(version1: string, version2: string): -1 | 0 | 1 {
  if (version1 === version2) {
    return 0
  }

  const [firstPart1, rest1 = '0'] = extractFirstVersionPart(version1)
  const [firstPart2, rest2 = '0'] = extractFirstVersionPart(version2)

  const firstNumber1 = parseInt(firstPart1)
  const firstNumber2 = parseInt(firstPart2)
  if (isNaN(firstNumber1) && isNaN(firstNumber2)) {
    return 0
  }
  if (isNaN(firstNumber1)) {
    return 1
  }
  if (isNaN(firstNumber2)) {
    return -1
  }
  if (firstNumber1 !== firstNumber2) {
    return firstNumber1 < firstNumber2 ? -1 : 1
  }

  return compareVersions(rest1, rest2)
}

export function isVersionInRange(range: VersionRange, version: string): boolean {
  return (
    (range.start === undefined || compareVersions(range.start, version) <= 0) &&
    (range.end === undefined || compareVersions(version, range.end) < 0)
  )
}

export function doVersionRangesIntersect(range1: VersionRange, range2: VersionRange): boolean {
  return (
    (range1.start === undefined || range2.end === undefined || compareVersions(range1.start, range2.end) < 0) &&
    (range2.start === undefined || range1.end === undefined || compareVersions(range2.start, range1.end) < 0)
  )
}

/**
 * Applies a conjunction operation to all the given version ranges.
 * I.e. makes such a range that is fully included in all the given ranges.
 */
export function intersectVersionRanges(range: VersionRange, ...ranges: VersionRange[]): VersionRange {
  const result = { ...range }
  for (const subRange of ranges) {
    if (subRange.start !== undefined) {
      result.start =
        result.start === undefined || compareVersions(result.start, subRange.start) < 0 ? subRange.start : result.start
    }
    if (subRange.end !== undefined) {
      result.end = result.end === undefined || compareVersions(result.end, subRange.end) > 0 ? subRange.end : result.end
    }
  }
  return result
}

/**
 * Makes the next closest version of the given version.
 * The precision is the same. For example, '3.2.1' turns into '3.2.2'.
 * It it's impossible to know the next version, returns undefined.
 */
export function getNextVersion(version: string): string | undefined {
  const match = /^(.*\.)?(\d+)$/.exec(version)
  if (!match) {
    return undefined
  }
  return `${match[1] || ''}${parseInt(match[2]) + 1}`
}

/**
 * Checks whether the version is stable, i.e. contains only unsigned integers split by a point.
 */
export function isStableVersion(version: string): boolean {
  return /^\d+(\.\d+)*$/.test(version)
}

/**
 * Checks whether the version is full and valid, i.e. matches an official SemVer regular expression
 *
 * @see https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
 */
export function isSemVerVersion(version: string): boolean {
  // A short synonym of the official regular expression:
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(0|[1-9]\d*|\d*[a-z-][0-9a-z-]*)(\.(0|[1-9]\d*|\d*[a-z-][0-9a-z-]*))*)?(\+[0-9a-z-]+(\.[0-9a-z-]+)*)?$/i.test(
    version,
  )
}

function extractFirstVersionPart(version: string): [first: string, rest?: string] {
  const pointIndex = version.indexOf('.')
  return pointIndex === -1 ? [version] : [version.slice(0, pointIndex), version.slice(pointIndex + 1)]
}
