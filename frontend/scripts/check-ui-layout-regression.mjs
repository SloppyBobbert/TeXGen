// Runs the real layout checker with isolated API mocks; no backend writes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const base = (process.env.UI_BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '');
const injection = late => `
  import { chromium } from '@playwright/test';
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async options => {
    const browser = await launch(options);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async options => {
      const context = await newContext(options);
      const inject = () => { setTimeout(() => { throw new Error('layout-check-regression-exception'); }, 0); };
      if (${late}) {
        const close = context.close.bind(context);
        context.close = async () => {
          const page = context.pages()[0];
          const error = page.waitForEvent('pageerror');
          await page.evaluate(inject);
          await error;
          return close();
        };
      } else {
        await context.addInitScript(inject);
      }
      return context;
    };
    return browser;
  };
`;

for (const suffix of ['', '/']) {
  test(`layout checker accepts base URL suffix ${JSON.stringify(suffix)}`, () => {
    const run = spawnSync(process.execPath, ['scripts/check-ui-layout.mjs'], {
      cwd, encoding: 'utf8', env: { ...process.env, UI_BASE_URL: base + suffix }, timeout: 240000,
    });
    assert.equal(run.status, 0, run.stderr || run.error?.message);
    assert.equal(JSON.parse(run.stdout).results.length, 10);
  });
}

for (const late of [false, true]) {
  test(`layout checker rejects an uncaught ${late ? 'late' : 'early'} page exception`, () => {
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', `${injection(late)}\nawait import('./scripts/check-ui-layout.mjs');`], {
      cwd, encoding: 'utf8', env: { ...process.env, UI_BASE_URL: base }, timeout: 240000,
    });
    assert.match(run.stderr, /Browser error: layout-check-regression-exception/);
    assert.equal(run.status, 1, run.stderr || run.error?.message);
    assert.match(run.stderr, /browser exceptions/);
    assert.doesNotMatch(run.stdout, /"passed": true/);
  });
}
