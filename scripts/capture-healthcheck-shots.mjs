/**
 * Capture README screenshots of the 插件检测 settings section from the live
 * web GUI. Run with the backend on :3080.
 *
 *   node scripts/capture-healthcheck-shots.mjs <outputDir>
 *
 * Produces:
 *   healthcheck-panel.png      — the settings section (before running)
 *   healthcheck-results.png    — after running a check (findings shown)
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Resolve playwright from the dsh-web-ui repo install (this repo has no
// playwright dependency of its own — it is a dev-only screenshot tool).
const require = createRequire(import.meta.url)
const playwrightPath = require.resolve('playwright', { paths: [process.env.DSH_WEB_UI_NODE_MODULES ?? resolve('../../dsh-web-ui/node_modules')] })
const { chromium } = require(playwrightPath)

const outDir = resolve(process.argv[2] ?? '.')
mkdirSync(outDir, { recursive: true })

const BASE = 'http://127.0.0.1:3080'
const VIEWPORT = { width: 1440, height: 900 }

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 })

  // 1. Open the web GUI and wait for the shell.
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('body', { timeout: 60_000 })
  await page.waitForTimeout(4_000) // let the shell settle

  // 2. Find the settings trigger in the sidebar foot. Confirmed via probe:
  //    button.VOzbGW_trigger with text 设置 (the settings seat in the left rail).
  const settingsButton = page.locator('button.VOzbGW_trigger').first()
  if (!(await settingsButton.count())) {
    console.error('settings trigger (.VOzbGW_trigger) not found')
    process.exit(1)
  }
  await settingsButton.click()
  await page.waitForTimeout(4_000)

  // 3. The settings panel modal renders ALL nav rows + section content at once
  //    (confirmed by probe: 通用设置/…/插件检测/SSH 远程工作区 are all in the
  //    DOM). Click the 插件检测 nav label to focus its section content.
  const navLabel = page.locator('span.VOzbGW_navLabel', { hasText: '插件检测' }).first()
  if (await navLabel.count()) {
    try {
      await navLabel.click({ timeout: 10_000 })
    } catch {
      console.warn('nav click failed — capturing panel as-is')
    }
  } else {
    console.warn('插件检测 nav not found — capturing panel as-is')
  }
  await page.waitForTimeout(3_000)

  // 4. Screenshot the whole viewport (settings modal + section content).
  const sectionEl = page.locator('body')
  await sectionEl.screenshot({ path: join(outDir, 'healthcheck-panel.png') })
  console.log('saved healthcheck-panel.png')

  // 5. Run a check: L0 + malware only (fast, no boot), scope = all.
  const runButton = page.locator('button:has-text("开始检测")').first()
  if (await runButton.count()) {
    await runButton.click()
    // wait for the run to finish (status poll) — poll the UI for done state
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1_000)
      const running = await page.locator('text=检测中…').count()
      if (running === 0) break
    }
    await page.waitForTimeout(1_000)
    await sectionEl.screenshot({ path: join(outDir, 'healthcheck-results.png') })
    console.log('saved healthcheck-results.png')
  } else {
    console.error('run button not found — screenshotting panel as-is')
  }
} finally {
  await browser.close()
}
