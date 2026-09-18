import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = resolve(ROOT, 'shots')

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const width = Number(arg('width', '1280'))
const height = Number(arg('height', '900'))
const url = arg('url', 'http://localhost:5273/')

const STEPS: Record<string, (page: Page, value: string) => Promise<unknown>> = {
  click: (page, value) => {
    const [x = 0, y = 0] = value.split(',').map(Number)
    return page.mouse.click(x, y)
  },
  'click-text': (page, value) => page.getByText(value, { exact: true }).first().click(),
  'click-selector': (page, value) => page.locator(value).first().click(),
  press: (page, value) => page.keyboard.press(value),
  type: (page, value) => page.keyboard.type(value, { delay: 40 }),
  fill: (page, value) => {
    const split = value.lastIndexOf('::')
    return page
      .locator(value.slice(0, split))
      .first()
      .fill(value.slice(split + 2))
  },
  cookie: (page, value) => {
    const [name = '', ...rest] = value.split('=')
    return page.context().addCookies([{ name, value: rest.join('='), url }])
  },
  'await-text': (page, value) =>
    page.waitForFunction((t) => document.body.innerText.includes(t), value, { timeout: 30_000 }),
  'await-path': (page, value) =>
    page.waitForFunction((path) => location.pathname === path, value, { timeout: 30_000 }),
  goto: (page, value) => page.goto(new URL(value, url).toString()),
  wait: (page, value) => page.waitForTimeout(Number(value)),
  shot: async (page, value) => {
    await mkdir(SHOTS, { recursive: true })
    await page.screenshot({ path: resolve(SHOTS, `${value}.png`), fullPage: true })
    console.log(`✓ shots/${value}.png`)
  },
}

const browser = await chromium.launch()
const mobile = process.argv.includes('--mobile')
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width, height },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
})

const messages: string[] = []
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    messages.push(`${message.type()}: ${message.text()}`)
  }
})
page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`))

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

for (const step of process.argv.slice(2).filter((a) => a.startsWith('--'))) {
  const [name = '', ...rest] = step.slice(2).split('=')
  const run = STEPS[name]
  if (run) {
    await run(page, rest.join('='))
  }
}

if (messages.length > 0) {
  console.log(`${messages.length} console message(s):`)
  for (const message of messages.slice(0, 8)) {
    console.log(`  ${message}`)
  }
}

await browser.close()
