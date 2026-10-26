import { expect, test } from '@playwright/test';

test('desktop: hovering a number opens the explain popover', async ({ page }) => {
  await page.goto('/home');
  await page.locator('.num').first().hover();
  await expect(page.getByTestId('explain-card')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
});
