import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'
import { markSvg } from '../src/ui/mark.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(ROOT, 'public')
const FONTS = resolve(ROOT, 'node_modules/@fontsource-variable')
const JOST = resolve(FONTS, 'jost/files/jost-latin-wght-normal.woff2')
const SERIF_ITALIC = resolve(FONTS, 'source-serif-4/files/source-serif-4-latin-opsz-italic.woff2')
const INK = '#252525'
const PAPER = '#ffffff'
const MIST = '#f6f6f6'
const OCHRE = '#b4841e'
const INSET = 22

async function render(page: Page, html: string, width: number, height: number, file: string) {
  await page.setViewportSize({ width, height })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: resolve(PUBLIC, file), omitBackground: true })
  console.log(`✓ public/${file}`)
}

function icon(size: number): string {
  const svg = markSvg(INK, PAPER, INSET)
  return `<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
}

function card(jost: string, serif: string): string {
  return `<style>
    @font-face { font-family: Jost; src: url(data:font/woff2;base64,${jost}) format('woff2'); font-weight: 100 900; }
    @font-face { font-family: Serif; font-style: italic; src: url(data:font/woff2;base64,${serif}) format('woff2'); font-weight: 200 900; }
    body { margin: 0; width: 1200px; height: 630px; display: grid; place-content: center; gap: 34px;
           justify-items: center; background: ${MIST}; color: ${INK}; font-family: Jost, sans-serif; }
    svg { width: 150px; height: 150px; }
    h1 { margin: 0; font-weight: 500; font-size: 52px; letter-spacing: 0.1em; margin-right: -0.1em; }
    hr { width: 96px; border: 0; border-top: 2px solid ${OCHRE}; margin: 0; }
    p { margin: 0; font: italic 400 34px Serif, Georgia, serif; color: #5f5f5f; }
  </style>${markSvg(INK)}<h1>CRITERION CLUB</h1><hr><p>Screenings, RSVPs and polls</p>`
}

const base64 = async (file: string) => (await readFile(file)).toString('base64')
const browser = await chromium.launch()
const page = await browser.newPage()
await writeFile(resolve(PUBLIC, 'favicon.svg'), `${markSvg(INK, PAPER, INSET)}\n`)
console.log('✓ public/favicon.svg')
await render(page, icon(64), 64, 64, 'favicon-64.png')
await render(page, icon(180), 180, 180, 'apple-touch-icon.png')
await render(page, card(await base64(JOST), await base64(SERIF_ITALIC)), 1200, 630, 'og-card.png')
await browser.close()
