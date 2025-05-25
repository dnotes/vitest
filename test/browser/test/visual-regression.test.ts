import { page, commands, server } from '@vitest/browser/context'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import '../src/button.css'

const path = `__screenshots__/visual-regression.png`
const filepath = `test/${path}`
const opts = { path }

afterAll(async () => {
  document.body.removeAttribute('style')
})
beforeAll(async () => {
  let promises = [`${filepath}.diff.png`, `${filepath}.actual.png`].map(async (f) => {
    try {
      await server.commands.removeFile(f)
    } catch(e){}
  })
  await Promise.all(promises)
})

describe('visual regression tests', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    document.body.innerHTML = `<button>Hello World!</button>`
  })

  test('new visual regression test', async () => {

    // ensure that the file doesn't already exist
    try {
      await server.commands.removeFile(path)
    } catch(e) {}

    const el = page.getByRole('button', { name: 'Hello World!' })
    try {
      await expect(el).toMatchScreenshot(opts)
    }
    catch(e) {
      if (!e.message.startsWith('Visual regression test: ENOENT')) throw e
    }
  })

  test('passing visual regression test', async () => {
    const el = page.getByRole('button', { name: 'Hello World!' })
    await expect(el).toMatchScreenshot(opts)
  })

  test('failing visual regression - different image content', async () => {
    document.body.innerHTML = `<button style="color:white;">Hello World!</button>`
    const el = page.getByRole('button', { name: 'Hello World!' })
    try {
      await expect(el).toMatchScreenshot({
        ...opts,
        maxDiffPercentage: 0,
      })
    }
    catch(e) {
      if (!e.message.startsWith('Images were too different')) throw e
    }
    await commands.removeFile(`${filepath}.actual.png`)
    await commands.removeFile(`${filepath}.diff.png`)
  })

  test('failing visual regression - different image sizes', async () => {
    document.body.innerHTML = `<button>Hello Dolly!</button>`
    const el = page.getByRole('button', { name: 'Hello Dolly!' })
    try {
      await expect(el).toMatchScreenshot({
        ...opts,
        maxDiffPercentage: 100,
      })
    }
    catch(e) {
      if (!e.message.startsWith('Image sizes do not match')) throw e
    }
    await commands.removeFile(`${filepath}.actual.png`)
  })

  test('default paths', async () => {
    const el = page.getByRole('button', { name: 'Hello World!' })

    // get the filename for the screenshot
    let autopath = await el.screenshot({ pathOnly:true })

    // ensure that the file doesn't already exist
    try {
      await commands.removeFile(autopath)
    }
    catch(e) {}

    // first create the screenshot
    try {
      await expect(el).toMatchScreenshot()
    }
    catch(e) {
      if (!e.message.startsWith('Visual regression test: ENOENT')) throw e
    }

    // then test a passing screenshot
    await expect(el).toMatchScreenshot({ path:autopath })

    // then test a screenshot that should fail
    document.body.innerHTML = `<button style="color:white;">Hello World!</button>`
    try {
      await expect(el).toMatchScreenshot({ path:autopath })
    }
    catch(e) {
      if (!e.message.startsWith('Images were too different')) throw e
    }

    await commands.removeFile(autopath)
    await commands.removeFile(`${autopath}.diff.png`)
    await commands.removeFile(`${autopath}.actual.png`)
  })

  test('passing visual regression, because maxDiffPercentage', async () => {
    document.body.innerHTML = `<button>Hello World<span style="color:white;">!</span></button>`
    const el = page.getByRole('button', { name: 'Hello World!' })
    await expect(el).toMatchScreenshot({
      ...opts,
      maxDiffPercentage: 10,
    })
  })

  test('passing visual regression, because of maxDiffPixels', async () => {
    document.body.innerHTML = `<button>Hello World<span style="color:white;">!</span></button>`
    const el = page.getByRole('button', { name: 'Hello World!' })
    await expect(el).toMatchScreenshot({
      ...opts,
      maxDiffPixels: 100,
    })
  })

})
