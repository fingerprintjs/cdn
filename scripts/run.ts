/* eslint-disable no-console */
/*
 * This script runs the lambda function locally by emulating a CloudFront request.
 * Prints the result in form of an HTTP request.
 */

import { CloudFrontResultResponse } from 'aws-lambda'
import { makeMockCloudFrontEvent, makeMockLambdaContext } from '../src/utils/mocks'
import { handler } from '../src'

async function run() {
  const { uri, fullBody } = parseInput()
  let response: CloudFrontResultResponse

  try {
    console.time('Execution time')
    response = (await handler(
      makeMockCloudFrontEvent(uri),
      makeMockLambdaContext(),
      () => undefined,
    )) as CloudFrontResultResponse
  } finally {
    console.timeEnd('Execution time')
  }

  printResponse(response, fullBody)
}

function parseInput() {
  const uriArgIndex = process.argv.indexOf('--uri')
  if (uriArgIndex === -1 || uriArgIndex === process.argv.length - 1) {
    throw 'The URI argument is missing. Try running the command with `--uri "/fingerprintjs/v3"`.'
  }
  const uri = process.argv[uriArgIndex + 1].split('?', 1)[0] // Query strings aren't supported
  const fullBody = process.argv.includes('--full-response-body')
  return { uri, fullBody }
}

function printResponse(response: CloudFrontResultResponse, fullBody: boolean) {
  console.log('Response:')
  console.log('')
  console.log(`HTTP/2 ${response.status} ${response.statusDescription ?? 'OK'}`)
  for (const [name, values] of Object.entries(response.headers || {})) {
    for (const { value } of values) {
      console.log(`${name}: ${value}`)
    }
  }
  if (response.body) {
    const shortBodyLength = 1000
    console.log('')
    console.log(
      fullBody || response.body.length <= shortBodyLength
        ? response.body
        : `${response.body?.slice(0, shortBodyLength)}...`,
    )
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
