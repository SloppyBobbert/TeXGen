import { test, expect } from '@playwright/test';

for (const [size, width, height] of [
  ['desktop', 1440, 900], ['mobile', 390, 900], ['narrow', 320, 900],
  ['phone', 375, 812], ['tablet', 768, 1024], ['landscape', 844, 390],
]) {
  test(`keyboard skip link and editor controls fit the viewport (${size})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeAttached();
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    await expect(page.getByRole('main')).toHaveCount(1);
    await page.getByLabel('UNIT CIRCLE', { exact: true }).check();
    await page.getByRole('button', { name: 'Generate / Regenerate' }).click();
    await page.getByRole('button', { name: 'Show LaTeX editor' }).click();
    await expect(page.getByLabel('Generated LaTeX Code:')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const editor = await page.getByLabel('Generated LaTeX Code:').boundingBox();
    expect(editor.x).toBeGreaterThanOrEqual(0);
    expect(editor.x + editor.width).toBeLessThanOrEqual(width + 1);
  });

  test(`class controls have separate keyboard actions and named handles (${size})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const response = await page.request.get('/api/classes/');
    expect(response.ok()).toBeTruthy();
    const { classes } = await response.json();
    const subject = classes.find((entry) => entry.categories?.some((category) => category.formulas?.length));
    expect(subject).toBeTruthy();
    await page.getByLabel(subject.name, { exact: true }).check();
    const order = page.getByRole('button', { name: 'Drag to reorder formulas' });
    if (await order.getAttribute('aria-expanded') === 'false') await order.click();
    const toggle = page.getByRole('button', { name: `Show formulas in ${subject.name}`, exact: true });
    await toggle.focus();
    await page.keyboard.press('Enter');
    const collapse = page.getByRole('button', { name: `Hide formulas in ${subject.name}`, exact: true });
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    const handles = page.getByRole('button', { name: /^Move formula / });
    await expect(handles.first()).toBeVisible();
    await expect(page.getByRole('button', { name: `Move class ${subject.name}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Remove all formulas from ${subject.name}`, exact: true })).toBeVisible();
    await collapse.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(handles).toHaveCount(0);
  });

  test(`video dialog contains and restores keyboard focus (${size})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route('https://www.youtube.com/embed/**', (route) => route.fulfill({ contentType: 'text/html', body: '<html><body>Video fixture</body></html>' }));
    await page.goto('/');
    await page.getByLabel('ALGEBRA I', { exact: true }).check();
    const showVideos = page.getByRole('button', { name: 'Show videos', exact: true });
    if (await showVideos.count()) await showVideos.click();
    const opener = page.locator('.video-card-sm').first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole('button', { name: 'Close video', exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('link', { name: 'Open on YouTube' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    const box = await close.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test(`editor respects reduced motion (${size})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const generate = page.getByRole('button', { name: 'Generate / Regenerate' });
    expect(await generate.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return [...style.transitionDuration.split(','), ...style.animationDuration.split(',')]
        .every((duration) => parseFloat(duration) <= 0.001);
    })).toBe(true);
  });
}

for (const preference of ['reduce', 'no-preference']) {
  test(`logo runtime animation respects ${preference}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: preference });
    await page.addInitScript(() => {
      window.logoScaleSamples = [];
      const sample = () => {
        const logo = document.querySelector('.app-logo');
        if (logo) {
          window.logoScaleSamples.push(new window.DOMMatrixReadOnly(window.getComputedStyle(logo).transform).a);
          if (window.logoScaleSamples.length >= 24) return;
        }
        window.requestAnimationFrame(sample);
      };
      window.requestAnimationFrame(sample);
    });
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => window.logoScaleSamples.length)).toBe(24);
    const animated = await page.evaluate(() => window.logoScaleSamples.some((scale) => scale > 0.9401 && scale < 0.9999));
    expect(animated).toBe(preference === 'no-preference');
  });
}

test('PDF scroll-to-top respects runtime reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({
      draftId: 'motion-runtime', title: 'Motion test', contentSource: 'manual',
      content: '\\documentclass{article}\\begin{document}First page\\newpage Second page\\end{document}',
    }));
  });
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
  const username = `motion${suffix}`;
  const password = `Motion-${suffix}-aA1!`;
  const registered = await page.request.post('/api/register/', { data: { username, password } });
  expect(registered.status()).toBe(201);
  await page.goto('/login');
  await page.locator('#login-username').fill(username);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  const compiled = page.waitForResponse((response) => response.url().includes('/api/compile/') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /^Compile PDF/ }).click();
  expect((await compiled).ok()).toBeTruthy();
  await expect(page.locator('.react-pdf__Page').first()).toBeVisible();
  const preview = page.locator('.pdf-preview-scroll');
  await preview.evaluate((element) => {
    element.style.height = '160px';
    element.style.minHeight = '0';
    element.style.maxHeight = '160px';
    element.scrollTop = 400;
    const scrollTo = element.scrollTo.bind(element);
    element.scrollTo = (options) => {
      window.pdfScrollBehavior = options.behavior;
      scrollTo(options);
    };
  });
  await page.getByRole('button', { name: 'Scroll to top', exact: true }).click();
  expect(await page.evaluate(() => window.pdfScrollBehavior)).toBe('auto');
  await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBe(0);
});

test('keyboard class and formula moves support cancellation, focus, and durable order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const response = await page.request.get('/api/classes/');
  expect(response.ok()).toBeTruthy();
  const { classes } = await response.json();
  const count = (entry) => entry.categories.reduce((total, category) => total + category.formulas.length, 0);
  const subjects = classes.filter((entry) => count(entry) >= 2).sort((a, b) => count(a) - count(b)).slice(0, 2);
  expect(subjects).toHaveLength(2);
  for (const subject of subjects) await page.getByLabel(subject.name, { exact: true }).check();
  const order = page.getByRole('button', { name: 'Drag to reorder formulas' });
  if (await order.getAttribute('aria-expanded') === 'false') await order.click();
  for (const subject of subjects) await page.getByRole('button', { name: `Show formulas in ${subject.name}`, exact: true }).click();

  const readRows = () => page.locator('.formula-class-group').evaluateAll((groups) => groups.map((group) => ({
    class: group.querySelector('button[aria-label^="Move class "]').getAttribute('aria-label').slice('Move class '.length),
    formulas: Array.from(group.querySelectorAll('button[aria-label^="Move formula "]'), (button) => button.getAttribute('aria-label')),
  })));
  const original = await readRows();
  const classHandle = page.getByRole('button', { name: `Move class ${original[0].class}`, exact: true });
  const expectClassTarget = (name = original[1].class) => expect(page.locator('[role="status"]').filter({ hasText: `was moved over droppable area class-${name}.` })).toHaveCount(1);
  await classHandle.focus();
  await page.keyboard.press('Space');
  await expect(classHandle).toHaveAttribute('aria-pressed', 'true');
  await expectClassTarget(original[0].class);
  await page.keyboard.press('ArrowDown');
  await expectClassTarget();
  await page.keyboard.press('Escape');
  await expect.poll(readRows).toEqual(original);
  await expect(classHandle).toBeFocused();
  await expect(classHandle).not.toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(classHandle).toHaveAttribute('aria-pressed', 'true');
  await expectClassTarget(original[0].class);
  await page.keyboard.press('ArrowDown');
  await expectClassTarget();
  await page.keyboard.press('Space');
  const moved = [original[1], original[0]];
  await expect.poll(readRows).toEqual(moved);
  await expect(classHandle).toBeFocused();

  await expect(classHandle).not.toHaveAttribute('aria-pressed', 'true');
  const formulaHandle = page.getByRole('button', { name: moved[0].formulas[0], exact: true });
  const nextFormulaName = moved[0].formulas[1].slice('Move formula '.length, -(` in ${moved[0].class}`).length);
  const currentFormulaName = moved[0].formulas[0].slice('Move formula '.length, -(` in ${moved[0].class}`).length);
  const expectFormulaTarget = (name = nextFormulaName) => expect(page.locator('[role="status"]')
    .filter({ hasText: `was moved over droppable area formula-${moved[0].class}-` })
    .filter({ hasText: `-${name}.` })).toHaveCount(1);
  await formulaHandle.focus();
  await page.keyboard.press('Space');
  await expect(formulaHandle).toHaveAttribute('aria-pressed', 'true');
  await expectFormulaTarget(currentFormulaName);
  await page.keyboard.press('ArrowDown');
  await expectFormulaTarget();
  await page.keyboard.press('Escape');
  await expect.poll(readRows).toEqual(moved);
  await expect(formulaHandle).toBeFocused();
  await expect(formulaHandle).not.toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(formulaHandle).toHaveAttribute('aria-pressed', 'true');
  await expectFormulaTarget(currentFormulaName);
  await page.keyboard.press('ArrowDown');
  await expectFormulaTarget();
  await page.keyboard.press('Space');
  const expected = [{ ...moved[0], formulas: [moved[0].formulas[1], moved[0].formulas[0], ...moved[0].formulas.slice(2)] }, moved[1]];
  await expect.poll(readRows).toEqual(expected);
  await expect(formulaHandle).toBeFocused();
  for (const subject of subjects) await expect(page.getByRole('button', { name: `Hide formulas in ${subject.name}`, exact: true })).toHaveAttribute('aria-expanded', 'true');

  const expectedSelections = expected.flatMap((group) => group.formulas.map((label) => {
    const subject = subjects.find((entry) => entry.name === group.class);
    const formula = subject.categories.flatMap((category) => category.formulas)
      .find((entry) => `Move formula ${entry.name} in ${group.class}` === label);
    expect(formula?.id).toBeTruthy();
    return { formula_id: formula.id };
  }));
  await expect.poll(() => page.evaluate(() => {
    const sheet = JSON.parse(localStorage.getItem('currentCheatSheet'));
    const identity = sheet.draftId ?? sheet.id;
    return JSON.parse(localStorage.getItem(`cheatSheetDraft:v1:${typeof identity}:${identity}`))?.formula_selections;
  })).toEqual(expectedSelections);
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('alert')).toContainText('Cheat sheet saved successfully!');
  await page.reload();
  if (await order.getAttribute('aria-expanded') === 'false') await order.click();
  for (const subject of subjects) await page.getByRole('button', { name: `Show formulas in ${subject.name}`, exact: true }).click();
  await expect.poll(readRows).toEqual(expected);
});

