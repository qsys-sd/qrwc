import { cp, readdir, rm, stat, readFile, writeFile } from 'fs/promises'

/**
 * Builds the following targets:
 * Node ESM
 * Node CJS
 * Browser ESM
 * Browser CJS
 *
 * Does so by building for the browser, then copies the browser build and replaces any files that have a '*.node.*' equivalent.
 */

const build = async () => {
  await cp('./package.esm.json', './dist/esm/package.json')
  await cp('./package.cjs.json', './dist/cjs/package.json')
  await cp('./dist/esm', './dist/esm-node', { recursive: true })
  await cp('./dist/cjs', './dist/cjs-node', { recursive: true })
  await resolveFiles('./dist/esm', false)
  await resolveFiles('./dist/cjs', false)
  await resolveFiles('./dist/esm-node', true)
  await resolveFiles('./dist/cjs-node', true)
}

const resolveFiles = async (path, isNode) => {
  const fileNames = await readdir(`${path}`)
  const fileStats = await Promise.all(
    fileNames.map((fileName) => stat(`${path}/${fileName}`))
  )

  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i]
    const fileStat = fileStats[i]

    if (fileStat.isDirectory()) {
      void resolveFiles(`${path}/${fileName}`, isNode)
      continue
    }

    if (fileName.includes('.node.')) {
      if (isNode && !fileName.includes('.map')) {
        const destFileName = fileName.replace('.node.', '.')
        await cp(`${path}/${fileName}`, `${path}/${destFileName}`, {
          force: true
        })
        await cp(`${path}/${fileName}.map`, `${path}/${destFileName}.map`, {
          force: true
        })
        // fix sourcemap refs
        const contents = await readFile(`${path}/${destFileName}.map`, {
          encoding: 'utf8'
        })
        // regex would be more reliable, but this is probably good enough?
        const newContents = contents.replaceAll(fileName, destFileName)
        await writeFile(`${path}/${destFileName}.map`, newContents)
      }
      void rm(`${path}/${fileName}`)
    }
  }
}

build()
