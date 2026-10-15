import { test, expect } from '@playwright/test';
import { submitLogin } from './helpers/submit-login.js';

const themes = ['light', 'dark', 'miami', 'forest', 'coolGrey', 'neon', 'galaxy', 'crimson', 'blossom'];

async function contrast(locator) {
  return locator.evaluate(element => {
    const context = document.createElement('canvas').getContext('2d');
    const rgba = color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const blend = (front, back) => front.slice(0, 3).map((c, i) => c * front[3] + back[i] * (1 - front[3]));
    const parents = [];
    for (let node = element; node; node = node.parentElement) parents.unshift(node);
    const background = parents.reduce((color, node) => blend(rgba(window.getComputedStyle(node).backgroundColor), color), [255, 255, 255]);
    const foreground = blend(rgba(window.getComputedStyle(element).color), background);
    const luminance = color => color.map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    return (values[1] + 0.05) / (values[0] + 0.05);
  });
}

async function selectTheme(page, theme) {
  await page.getByRole('combobox', { name: 'Select theme' }).selectOption(theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.waitForFunction(() => document.getAnimations().every(animation =>
    animation.playState === 'finished' || animation.playState === 'idle'));
}

async function generateFailure(page) {
  await page.route('**/api/compile/', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, json: { error: 'Injected compile failure' } }) : route.continue());
  await page.getByLabel('UNIT CIRCLE', { exact: true }).check();
  await page.getByRole('button', { name: 'Generate / Regenerate', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Compile failed. No PDF is available.');
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
});

test('contrast measurement handles solid and translucent colors', async ({ page }) => {
  await page.setContent('<div style="background:white"><span id="solid" style="color:black">Solid</span><div style="background:rgba(0,0,0,0.5)"><span id="alpha" style="color:white">Alpha</span></div></div>');
  expect(await contrast(page.locator('#solid'))).toBeCloseTo(21, 5);
  expect(await contrast(page.locator('#alpha'))).toBeGreaterThan(3.9);
  expect(await contrast(page.locator('#alpha'))).toBeLessThan(4.1);
});

test('compile errors have readable text in every theme', async ({ page }) => {
  await generateFailure(page);
  for (const theme of themes) {
    await selectTheme(page, theme);
    expect.soft(await contrast(page.locator('.compile-error-box').first()), `${theme} compile error`).toBeGreaterThanOrEqual(4.5);
  }
});

test('PDF load errors have readable text in every theme', async ({ page }) => {
  await page.route('**/api/compile/', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 200, contentType: 'application/pdf', body: 'Invalid PDF fixture' }) : route.continue());
  await page.getByLabel('UNIT CIRCLE', { exact: true }).check();
  await page.getByRole('button', { name: 'Generate / Regenerate', exact: true }).click();
  await expect(page.locator('.pdf-state-error')).toBeVisible();
  for (const theme of themes) {
    await selectTheme(page, theme);
    expect.soft(await contrast(page.locator('.pdf-state-error')), `${theme} PDF error`).toBeGreaterThanOrEqual(4.5);
  }
});

test('secondary editor text remains readable across themes', async ({ page }) => {
  await page.getByLabel('UNIT CIRCLE', { exact: true }).check();
  for (const theme of themes) {
    await selectTheme(page, theme);
    for (const selector of ['.panel-label', '.selection-count-copy']) {
      expect.soft(await contrast(page.locator(selector).first()), `${theme} ${selector}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('native controls use the selected theme color scheme', async ({ page }) => {
  for (const theme of themes) {
    await selectTheme(page, theme);
    const expected = ['light', 'blossom'].includes(theme) ? 'light' : 'dark';
    expect.soft(await page.locator('html').evaluate(e => window.getComputedStyle(e).colorScheme), theme).toBe(expected);
  }
});

test('custom layout inputs have distinct accessible names', async ({ page }) => {
  await page.getByLabel('Text Size:', { exact: true }).selectOption('custom');
  await expect(page.getByRole('textbox', { name: 'Custom text size' })).toHaveValue('10.5pt');
  await page.getByLabel('Spacing:', { exact: true }).selectOption('custom');
  await expect(page.getByRole('textbox', { name: 'Custom spacing' })).toHaveValue('0.8pt');
});

test('workspace toggles report their expanded state', async ({ page }) => {
  await generateFailure(page);
  for (const [name, initiallyOpen] of [[/^(Hide|Show) subjects$/, true], [/^(Hide|Show) videos$/, true], [/^(Hide|Show) LaTeX editor$/, false]]) {
    const button = page.getByRole('button', { name });
    await expect(button).toHaveAttribute('aria-expanded', String(initiallyOpen));
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', String(!initiallyOpen));
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', String(initiallyOpen));
  }
  await expect(page.getByRole('button', { name: /^Snapshots/ })).toHaveAttribute('aria-expanded', 'false');
});

async function openDashboard(page) {
  const username = `polish${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
  const password = 'Quartz!River7-Cobalt';
  expect((await page.request.post('/api/register/', { data: { username, password } })).status()).toBe(201);
  await page.goto('/login');
  await page.locator('#login-username').fill(username);
  await page.locator('#login-password').fill(password);
  await submitLogin(page);
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  const title = 'LongSheetTitle'.repeat(15);
  await page.route('**/api/cheatsheets/', route => route.fulfill({ json: [
    { id: 1, title, created_at: '2026-01-01', updated_at: '2026-01-02' },
    { id: 2, title: 'Second sheet', created_at: '2026-01-01', updated_at: '2026-01-02' },
  ] }));
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  return title;
}

test('long saved titles remain fully visible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const title = await openDashboard(page);
  const dimensions = await page.getByRole('heading', { name: title }).evaluate(element => ({
    height: element.clientHeight, lineHeight: parseFloat(window.getComputedStyle(element).lineHeight),
    width: element.clientWidth, scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.height).toBeGreaterThan(dimensions.lineHeight * 2);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('Dashboard errors remain readable across themes', async ({ page }) => {
  await openDashboard(page);
  await page.route('**/api/cheatsheets/', route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Failed to load cheat sheets');
  for (const theme of themes) {
    await selectTheme(page, theme);
    expect.soft(await contrast(page.getByRole('alert')), `${theme} Dashboard error`).toBeGreaterThanOrEqual(4.5);
  }
});

test('saved-sheet actions identify the corresponding sheet', async ({ page }) => {
  const title = await openDashboard(page);
  const cards = page.locator('.sheet-card');
  for (const [index, description] of [[0, title], [1, 'Second sheet']]) {
    for (const name of ['Edit', 'Download PDF', 'Delete']) {
      await expect(cards.nth(index).getByRole('button', { name, exact: true })).toHaveAccessibleDescription(description);
    }
  }
});
