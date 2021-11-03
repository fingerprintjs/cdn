import * as path from 'path'
import { promises as fs } from 'fs'
import { CloudFrontRequestHandler, CloudFrontResultResponse } from 'aws-lambda'
import { makeCacheHeaders, makeCorsHeaders, notFoundStatus, okStatus } from './utils/http'
import { parseRequestUri } from './router'
import { downloadPackage, ErrorName as NpmError } from './npm'

/**
 * The entrypoint of the lambda function
 */
export const handler: CloudFrontRequestHandler = async (event) => {
  const request = event.Records[0].cf.request

  if (request.uri === '/') {
    return {
      ...okStatus,
      headers: {
        ...makeCorsHeaders(),
        ...makeCacheHeaders(immutableCacheDuration),
      },
      body: 'Hello, have a nice day',
    }
  }

  const uriData = parseRequestUri(request.uri)
  if (!uriData) {
    return makeNotFoundResponse(`The ${request.uri} path doesn't exist`)
  }

  if (uriData.version.requestedType === 'vague') {
    // todo: Implement the vague version redirect
    return {
      status: '501',
      statusDescription: 'Not Implemented',
      headers: makeCorsHeaders(),
      body: 'Coming coon...',
    }
  }

  try {
    const mainScript = await getPackageMainScript(uriData.project.npmName, uriData.version.requestedVersion)
    return {
      ...okStatus,
      headers: {
        ...makeCorsHeaders(),
        ...makeCacheHeaders(immutableCacheDuration),
        'content-type': [{ value: 'application/javascript; charset=utf-8' }],
      },
      body: mainScript,
    }
  } catch (error) {
    if (error instanceof Error && error.name === NpmError.NpmNotFound) {
      return makeNotFoundResponse(`There is no version ${uriData.version.requestedVersion}`)
    }
    throw error
  }
}

async function getPackageMainScript(name: string, version: string): Promise<string> {
  const packageDirectory = await downloadPackage(name, version)
  const packageJsonContent = await fs.readFile(path.join(packageDirectory, 'package.json'), 'utf8')
  const packageDescription = JSON.parse(packageJsonContent)

  for (const relativePath of [packageDescription.module, packageDescription.main]) {
    if (typeof relativePath !== 'string') {
      continue
    }
    const fullPath = path.join(packageDirectory, ...relativePath.split('/'))
    try {
      return await fs.readFile(fullPath, 'utf8')
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT' || // Means that the file doesn't exist
        (error as NodeJS.ErrnoException).code === 'EISDIR' // Means that the path is a directory
      ) {
        continue
      }
      throw error
    }
  }

  throw new Error('The package has no main file')
}

function makeNotFoundResponse(message: string): CloudFrontResultResponse {
  return {
    ...notFoundStatus,
    headers: {
      ...makeCorsHeaders(),
      ...makeCacheHeaders(notFoundBrowserCacheDuration, notFoundCdnCacheDuration),
    },
    body: message,
  }
}

const oneHour = 60 * 60 * 1000
const oneDay = oneHour * 24
const oneYear = oneDay * 365
const immutableCacheDuration = oneYear
const notFoundBrowserCacheDuration = oneDay
const notFoundCdnCacheDuration = oneHour
