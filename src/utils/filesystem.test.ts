import { promises as fs } from 'fs'
import * as path from 'path'
import { makeTemporaryDirectory, readFirstCharacters, withTemporaryFile } from './filesystem'

describe('makeTemporaryDirectory', () => {
  it('creates a writable directory', async () => {
    let directory: string | undefined

    try {
      directory = await makeTemporaryDirectory()
      await fs.writeFile(path.join(directory, 'test.txt'), 'It works')
    } finally {
      if (directory !== undefined) {
        await fs.rm(directory, { recursive: true, force: true })
      }
    }
  })
})

describe('readFirstCharacters', () => {
  const mockText =
    "👫 Make it pop can you make it pop we exceed the clients' expectations and concept is bang on, but can we look" +
    ' at a better execution we need to make the new version clean and sexy. Can you please send me the design specs' +
    ' again?. This is just a 5 minutes job can you put "find us on facebook" by the facebook logo? there is too much' +
    ' white space but can you turn it around in photoshop so we can see more of the front, so was i smoking crack' +
    ' when i sent this? hahaha! or mmm, exactly like that, but different. Concept is bang on, but can we look at a' +
    ' better execution. Make it pop something summery; colourful. I like it, but can the snow look a little warmer' +
    ' can you pimp this powerpoint, need more geometry patterns.' // 716 JavaScript characters

  it('reads a not till the end', async () => {
    await withTemporaryFile(mockText, async (file) => {
      expect(await readFirstCharacters(file, mockText.length - 100)).toEqual(mockText.slice(0, -100))
    })
  })

  it('reads till the end', async () => {
    await withTemporaryFile(mockText, async (file) => {
      expect(await readFirstCharacters(file, mockText.length + 100)).toEqual(mockText)
    })
  })
})
