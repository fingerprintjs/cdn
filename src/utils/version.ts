/**
 * Compares version strings.
 * Returns:
 * -1 - the first version is lower than the second version
 *  0 - the versions are equal
 *  1 - the first version is greater than the second version
 */
export function compareVersions(version1: string, version2: string): -1 | 0 | 1 {
  const [firstPart1, rest1] = extractFirstVersionPart(version1)
  const [firstPart2, rest2] = extractFirstVersionPart(version2)

  const firstNumber1 = parseInt(firstPart1)
  const firstNumber2 = parseInt(firstPart2)
  if (isNaN(firstNumber1) && isNaN(firstNumber2)) {
    return 0
  }
  if (isNaN(firstNumber1)) {
    return -1
  }
  if (isNaN(firstNumber2)) {
    return 1
  }
  if (firstNumber1 !== firstNumber2) {
    return firstNumber1 < firstNumber2 ? -1 : 1
  }

  // The first numbers of the versions are equal, so comparing the rest parts of the versions
  if (rest1 === undefined && rest2 === undefined) {
    return 0
  }
  if (rest1 === undefined) {
    return -1
  }
  if (rest2 === undefined) {
    return 1
  }
  return compareVersions(rest1, rest2)
}

/**
 * Checks whether the version lies in the version range.
 * The start version is included and the end version is NOT included.
 */
export function isVersionInRange(
  startVersion: string | undefined,
  versionToCheck: string,
  endVersion: string | undefined,
): boolean {
  return (
    (startVersion === undefined || compareVersions(startVersion, versionToCheck) <= 0) &&
    (endVersion === undefined || compareVersions(versionToCheck, endVersion) < 0)
  )
}

function extractFirstVersionPart(version: string): [first: string, rest?: string] {
  const pointIndex = version.indexOf('.')
  return pointIndex === -1 ? [version] : [version.slice(0, pointIndex), version.slice(pointIndex + 1)]
}
