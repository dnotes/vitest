import type { MatcherState, SyncExpectationResult } from '@vitest/expect'
import { server, page } from '@vitest/browser/context'
import pixelmatch from 'pixelmatch'
import { Buffer } from 'buffer'
import { PNG } from 'pngjs/browser'

export type ScreenshotDiffOptions = {
  path?: string
  perBrowser?: boolean
  maxDiffPercentage: number
  maxDiffPixels: number
  // this is in pixelmatch.PixelmatchOptions, as provided in @types/pixelmatch, but I can't seem to import in this project
  threshold?: number | undefined;
  includeAA?: boolean | undefined;
  alpha?: number | undefined;
  aaColor?: [number, number, number] | undefined;
  diffColor?: [number, number, number] | undefined;
  diffColorAlt?: [number, number, number] | undefined;
  diffMask?: boolean | undefined;
}

export type ScreenshotDiffResult = {
  diff: Buffer,
  pixels: number,
  pct: number,
}

export default async function toMatchScreenshot(
  this: MatcherState,
  locator: any,
  options: Partial<ScreenshotDiffOptions> = {},
): Promise<SyncExpectationResult> {

  if (locator instanceof Element) locator = page.elementLocator(locator)

  let {
    path = '',
    perBrowser = false,
    maxDiffPercentage = 0,
    maxDiffPixels = 0,
  } = options

  path = await locator.screenshot({ path, pathOnly:true })
  if (perBrowser) path = path.replace(/\.png$/, `.${server.browser}.png`)

  // Get the expected image (or save a new one if none exists)
  let expected:Buffer
  try {
    let expectedImg = await server.commands.readFile(path, 'base64')
    expected = Buffer.from(expectedImg, 'base64')
  }
  catch(e:any) {
    await locator.screenshot({ path })
    return {
      pass: false,
      message: () => `Visual regression test: ${e.message}`,
    }
  }

  // Get the actual image
  let actual:Buffer
  try {
    let screenshotOptions = { save:false, base64:true }
    let actualImg = await locator.screenshot(screenshotOptions) as string|{ base64:string }
    actual = Buffer.from(typeof actualImg === 'string' ? actualImg : actualImg.base64, 'base64')
  }
  catch(e) {
    return {
      pass: false,
      message: () => `Could not get screenshot for ${locator.toString()}.`,
    }
  }

  let matchResult:ScreenshotDiffResult
  try {
    matchResult = await screenshotDiff(actual, expected, options)
  }
  catch(e:any) {
    await locator.screenshot({ path:`${path}.actual.png` })
    return {
      pass: false,
      message: () => `${e.message}`,
    }
  }

  // If the screenshots match, pass the test
  if (matchResult.pct <= maxDiffPercentage || matchResult.pixels <= maxDiffPixels) return {
    pass: true,
    message: () => `Visual regression test passed: ${path}.`,
  }

  // Otherwise, the test fails
  await server.commands.writeFile(`${path}.diff.png`, matchResult.diff.toString('base64'), 'base64');
  await locator.screenshot({ path:`${path}.actual.png` })

  return {
    pass: false,
    message: () => ([
      `Images were too different: ${path}`,
      `Diff percentage: ${matchResult.pct.toFixed(2)}% (max ${maxDiffPercentage}%)`,
      `Pixels: ${matchResult.pixels} (max ${maxDiffPixels})`,
      `Diff paths: ${path}.{actual,diff}.png`,
    ].join('\n')),
  }

}


async function screenshotDiff(actual:Buffer, expected:Buffer, opts:Partial<ScreenshotDiffOptions>): Promise<ScreenshotDiffResult> {

  // Parse PNG images to get raw pixel data
  const actualPng = PNG.sync.read(actual)
  const expectedPng = PNG.sync.read(expected)
  const { width, height } = expectedPng

  const diffPng = new PNG({ width, height })

  const pixels = pixelmatch(
    actualPng.data,
    expectedPng.data,
    diffPng.data,
    width,
    height,
    opts
  )

  const pct = (pixels / (width * height)) * 100

  return { diff:PNG.sync.write(diffPng), pixels, pct }
}
