import * as path from 'path'
import * as os from 'os'
import { createReadStream, promises as fs } from 'fs'

export function makeTemporaryDirectory(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'fpjs-'))
}

export async function readFirstCharacters(filePath: string, maxLength: number): Promise<string> {
  let fileContent = ''
  const readStream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: maxLength })

  try {
    await new Promise<void>((resolve, reject) => {
      readStream.on('data', (chunk) => {
        fileContent += chunk
        if (fileContent.length >= maxLength) {
          fileContent = fileContent.slice(0, maxLength)
          resolve()
        }
      })
      readStream.on('error', reject)
      readStream.on('end', resolve)
    })
  } finally {
    readStream.close()
  }

  return fileContent
}

export async function withTemporaryFiles<T>(
  files: Record<string, string>,
  action: (directory: string) => Promise<T> | T,
): Promise<T> {
  const directory = await makeTemporaryDirectory()
  try {
    await Promise.all(
      Object.entries(files).map(async ([filePath, content]) => {
        const fileFullPath = path.join(directory, filePath)
        await fs.mkdir(path.dirname(fileFullPath), { recursive: true })
        await fs.writeFile(fileFullPath, content)
      }),
    )
    return await action(directory)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}

export async function withTemporaryFile<T>(content: string, action: (file: string) => Promise<T> | T): Promise<T> {
  const file = path.join(os.tmpdir(), `fpjs-${Math.random().toString(36).slice(2)}.txt`)

  try {
    await fs.writeFile(file, content)
    return await action(file)
  } finally {
    await fs.rm(file, { force: true })
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const fileInfo = await fs.lstat(path)
    return fileInfo.isDirectory()
  } catch (error) {
    // Means that the file doesn't exist
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/**
 * Returns `true` if the whole directory was emptied and removed
 */
export async function removeFilesNotMatchingRecursively(directory: string, fileNameAllowFilter: RegExp) {
  const items = await fs.readdir(directory, { withFileTypes: true })
  let isSomethingLeft = false

  await Promise.all(
    items.map(async (item) => {
      const itemPath = path.join(directory, item.name)
      if (item.isDirectory()) {
        const isDirectoryDeleted = await removeFilesNotMatchingRecursively(itemPath, fileNameAllowFilter)
        if (!isDirectoryDeleted) {
          isSomethingLeft = true
        }
      } else if (item.isFile()) {
        if (fileNameAllowFilter.test(itemPath)) {
          isSomethingLeft = true
        } else {
          await fs.rm(itemPath)
        }
      } else {
        isSomethingLeft = true
      }
    }),
  )

  if (!isSomethingLeft) {
    await fs.rmdir(directory)
    return true
  }

  return false
}
