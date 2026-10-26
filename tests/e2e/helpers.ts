import { expect, type Page } from '@playwright/test';

/** Spec §13: every element with class `num` has an explain trigger. */
export async function expectAllNumsExplained(page: Page) {
  const nums = page.locator('.num');
  const n = await nums.count();
  expect(n).toBeGreaterThan(0);
  const bad = await nums.evaluateAll((els) =>
    els.filter((e) => !(e.tagName === 'BUTTON' && e.hasAttribute('data-explain') && e.getAttribute('aria-haspopup') === 'dialog')).length,
  );
  expect(bad).toBe(0);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function goto(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/** Sets a range input (fill() rejects values that are off the step grid). */
export async function setRange(page: Page, name: string | RegExp, value: number, scope = page.locator('body')) {
  await scope.getByRole('slider', { name }).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
