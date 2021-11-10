import { CloudFrontRequestEvent, Context } from 'aws-lambda'

export function makeMockCloudFrontEvent(uri: string): CloudFrontRequestEvent {
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

export function makeMockLambdaContext() {
  return {} as unknown as Context
}
