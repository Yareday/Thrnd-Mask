const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
    const extension = path.resolve(__dirname, '../extension');
    const context = await chromium.launchPersistentContext('', { headless: true, channel: 'chromium', args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`], viewport: { width: 1400, height: 1100 } });
    try {
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        const id = new URL(worker.url()).host; const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(`chrome-extension://${id}/legacy/player.html`);
        await page.click('#demo'); await page.waitForFunction(() => document.querySelector('#coverage').textContent === '90 / 90 classified');
        assert.equal(await page.locator('.cell.skip').count(), 4);
        await page.click('#play');
        await page.waitForFunction(() => document.querySelector('#video').currentTime > 0, {}, { timeout: 35000 });
        await page.$eval('#video', v => v.currentTime = 9.8); await page.waitForFunction(() => document.querySelector('#video').currentTime >= 14, {}, { timeout: 4000 });
        await page.waitForFunction(() => document.querySelector('#skips').textContent === '2 skipped segments');
        await page.screenshot({ path: path.resolve(__dirname, '../browser-preview.png'), fullPage: true });
        await page.uncheck('#violence'); await page.waitForFunction(() => document.querySelectorAll('.cell.skip').length === 2); assert((await page.$eval('#video', v => v.currentTime)) >= 14);
        await page.locator('#file').setInputFiles(path.join(extension, 'legacy/demo.mp4'));
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Enter your key'));
        await page.waitForFunction(() => document.querySelector('#coverage').textContent === '0 / 90 classified');
        assert.equal(await page.locator('#coverage').textContent(), '0 / 90 classified');
        assert.equal(errors.length, 0, errors.join('\n'));
        console.log('PASS: unpacked MV3 extension loads; 90 events; demo plays without countdown; merged skip; toggles reset; no-key AI fails closed; no browser errors.');
    } finally { await context.close(); }
})().catch(e => { console.error(e); process.exit(1); });
