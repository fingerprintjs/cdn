import { CloudFrontRequestEvent, CloudFrontResultResponse, Context } from 'aws-lambda'
import { handler } from './lambda'

async function test() {
  try {
    let response: CloudFrontResultResponse

    try {
      console.time('Package download')
      response = (await handler(
        makeMockEvent('/fingerprintjs/v3'),
        makeMockContext(),
        () => undefined,
      )) as CloudFrontResultResponse
    } finally {
      console.timeEnd('Package download')
    }

    console.log(response.status, response.headers, response.body?.slice(0, 1000))
  } catch (error) {
    console.error('Unexpected error')
    console.error(error)
  }
}

function makeMockEvent(uri: string): CloudFrontRequestEvent {
  return {
    Records: [
      {
        cf: {
          config: {
            distributionDomainName: 'd111111abcdef8.cloudfront.net',
            distributionId: 'EDFDVBD6EXAMPLE',
            eventType: 'origin-request',
            requestId: '4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ==',
          },
          request: {
            clientIp: '203.0.113.178',
            headers: {},
            method: 'GET',
            querystring: '',
            uri,
          },
        },
      },
    ],
  }
}

function makeMockContext() {
  return {} as unknown as Context
}

test()
