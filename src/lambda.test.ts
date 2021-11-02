import { CloudFrontRequestEvent, Context } from 'aws-lambda'
import { handler } from './lambda'

async function test() {
  try {
    let response: unknown

    try {
      console.time('Package download')
      response = await handler({} as unknown as CloudFrontRequestEvent, {} as unknown as Context, () => undefined)
    } finally {
      console.timeEnd('Package download')
    }

    console.log(response)
  } catch (error) {
    console.error('Unexpected error')
    console.error(error)
  }
}

test()
