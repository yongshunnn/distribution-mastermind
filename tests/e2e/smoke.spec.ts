import { expect, test } from '@playwright/test';
import { expectAllNumsExplained, expectNoHorizontalScroll, goto, setRange } from './helpers';

const ids = {
  SG: '4914d0d3-f6fa-5b26-966a-da94482d8020',
  MY: '8d110034-6263-53f9-acbe-7b8b459a5f2f',
  MM: 'd350763f-823f-5e35-918b-d0270ab38460',
  principal: 'ed3d35fe-7bb1-5bb6-b4bc-94d25f8c4851',
  fortune: '6cea96a2-e316-50e3-8617-a5da719b6062',
  foodmax: 'a88cd0b8-6bd7-5b0c-a574-e73d6b17eb30',
  nsk: '8f68ad4c-0cad-5c26-8052-5e071353bab1',
  goldenLand: 'b7da35fb-8f83-5f31-a162-abd2cf471728',
  scenario: 'd4aa221f-82e9-5e78-b24b-eee195475988',
};

test.describe('explain coverage (spec §13)', () => {
  for (const [name, path] of [
    ['Home', '/home'],
    ['Play', `/plays/${ids.fortune}`],
    ['Market', `/markets/${ids.MY}`],
    ['3D page', `/supply-chain?market=${ids.SG}`],
  ] as const) {
    test(`${name}: every .num has an explain trigger, no horizontal scroll at 375px`, async ({ page }) => {
      await goto(page, path);
      await expectAllNumsExplained(page);
      await expectNoHorizontalScroll(page);
    });
  }
});

test('every main screen fits 375px without horizontal scroll', async ({ page }) => {
  const paths = ['/plays', '/markets', '/principals', '/catalogue', '/partners', '/scenarios', '/watch', '/audit/new', '/settings', '/more',
    `/markets/${ids.MY}/stages`, `/markets/${ids.MY}/channels`, `/markets/${ids.MM}/competition`, `/markets/${ids.MY}/trade`, `/markets/${ids.MY}/routes`, `/markets/${ids.MY}/data`,
    `/principals/${ids.principal}/setup`, `/principals/${ids.principal}/pnl`, `/scenarios/${ids.scenario}`, `/plays/${ids.nsk}`];
  for (const p of paths) {
    await goto(page, p);
    await test.step(p, () => expectNoHorizontalScroll(page));
  }
});

test('tapping a number opens a bottom sheet with meaning, formula and breakdown that drills down', async ({ page }) => {
  await goto(page, `/plays/${ids.foodmax}`);
  await page.locator('.num[data-explain="contribution_per_unit"]').first().click();
  const card = page.getByTestId('explain-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Meaning');
  await expect(card).toContainText('Formula');
  await expect(card).toContainText('P_net − L − W − D − M − K');
  await expect(card).toContainText('Breakdown');
  await expect(card).toContainText('Most sensitive input');
  // Drill down to a raw input.
  await card.getByRole('button', { name: /Net price/ }).click();
  await expect(card).toContainText('list × (1 − channel margin − rebate)');
});

test('milestone 4: FoodMax 5L and Fortune 1L show contribution with full breakdowns', async ({ page }) => {
  for (const id of [ids.foodmax, ids.fortune]) {
    await goto(page, `/plays/${id}`);
    await expect(page.locator('.num[data-explain="contribution_per_unit"]').first()).toBeVisible();
    await expect(page.getByTestId('waterfall-layers').locator('li')).not.toHaveCount(0);
    await expect(page.getByText('Price build-back')).toBeVisible();
    await expect(page.getByTestId('play-sliders')).toBeVisible();
  }
});

test('sensitivity sliders restack contribution live', async ({ page }) => {
  await goto(page, `/plays/${ids.fortune}`);
  const live = page.getByTestId('play-sliders').locator('.num[data-explain="contribution_per_unit"]');
  const before = await live.getAttribute('aria-label');
  await setRange(page, 'Shelf price', 6, page.getByTestId('play-sliders'));
  await expect(live).not.toHaveAttribute('aria-label', before!);
});

test('milestone 2: editing a seeded value keeps history', async ({ page }) => {
  await goto(page, `/markets/${ids.MY}/data`);
  await page.locator('.num[data-explain="distributor_margin"]').first().click();
  const card = page.getByTestId('explain-card');
  await expect(card).toContainText('BeatRoute');
  await card.getByRole('button', { name: 'Edit value' }).click();
  const form = page.getByTestId('edit-value-form');
  await form.locator('input[name="value_num"]').fill('9');
  await form.locator('input[name="source_label"]').fill('Distributor quote A');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.num[data-explain="distributor_margin"]').first()).toHaveAttribute('aria-label', /9%/);
  await page.locator('.num[data-explain="distributor_margin"]').first().click();
  await expect(page.getByTestId('explain-card')).toContainText('Seed: 8%');
  await expect(page.getByTestId('explain-card')).toContainText('Distributor quote A');
});

test('milestone 5: Malaysia and Myanmar trackers show seeded statuses and update on a phone', async ({ page }) => {
  await goto(page, `/markets/${ids.MM}/stages`);
  await expect(page.getByText('Market paused').first()).toBeVisible();
  const stage4 = page.getByTestId('tracker').locator(':scope > details').filter({ hasText: 'Compliance & setup' });
  await expect(stage4.locator('summary').first()).toContainText('Blocked');
  await stage4.locator('summary').first().click();
  await expect(stage4.locator('details[id^="item-"]', { hasText: 'Import licence route' }).locator('summary')).toContainText('Blocked');
  await goto(page, `/markets/${ids.MY}/stages`);
  const item = page.locator('details[id^="item-"]', { hasText: 'Market scorecard filled' });
  await item.locator('summary').click();
  await item.getByLabel('Status').selectOption('done');
  await item.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('details[id^="item-"]', { hasText: 'Market scorecard filled' }).locator('summary')).toContainText('Done');
});

test('pipeline board on Home lists both trackers', async ({ page }) => {
  await goto(page, '/home');
  const board = page.getByTestId('pipeline-board');
  await expect(board).toContainText('Malaysia');
  await expect(board).toContainText('Myanmar');
});

test("milestone 6: Golden Land's 15% ask is flagged red", async ({ page }) => {
  await goto(page, `/partners/${ids.goldenLand}`);
  await expect(page.locator('[data-verdict="above"]')).toContainText('Gross margin');
  await expect(page.locator('[data-verdict="above"]')).toContainText('Myanmar proposal');
});

test('milestone 6: a Malaysia distributor proposal can be exported', async ({ page, request }) => {
  await goto(page, `/proposal?market=${ids.MY}&principal=${ids.principal}&role=distributor`);
  await expect(page.locator('article.proposal h1')).toContainText('Malaysia');
  await expect(page.locator('article.proposal')).toContainText('Commercial framework');
  const md = await request.get(`/api/proposal?market=${ids.MY}&principal=${ids.principal}&role=distributor`);
  expect(md.status()).toBe(200);
  expect(md.headers()['content-disposition']).toContain('.md');
  expect(await md.text()).toContain('## 6. What we need from you');
});

test('store audit form saves an observation and keeps outlet details', async ({ page }) => {
  await goto(page, `/audit/new?market=${ids.MY}`);
  const form = page.getByTestId('audit-form');
  await form.getByLabel('Outlet name').fill('NSK Kuchai Lama');
  await form.getByLabel('Brand', { exact: true }).fill('Test Brand');
  await form.getByLabel('Pack size').fill('900');
  await form.getByLabel('Shelf price').fill('6.50');
  await form.getByRole('button', { name: 'Save & next' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved Test Brand' })).toBeVisible();
  await expect(form.getByLabel('Outlet name')).toHaveValue('NSK Kuchai Lama');
  await goto(page, `/markets/${ids.MY}/competition`);
  await expect(page.getByText('Test Brand 900ml')).toBeVisible();
});

test('milestone 3: CSV SKU import previews new/changed/conflicting rows, then applies', async ({ page }) => {
  await goto(page, '/catalogue/import');
  const csv = [
    'sku_code,family,brand,variant_attr:scent,size,size_unit,units_per_carton,carton_l_cm,carton_w_cm,carton_h_cm,cartons_per_pallet,hs_code,market,price_type,price,currency',
    'KEON-DW-2L,Dishwashing liquid,SG KEON,Lime,2,l,6,33,24,30,60,3402.90,MY,shelf,14.90,MYR',
    'KEON-DW-1L,Dishwashing liquid,SG KEON,Lemon,1,l,10,37,28,27,60,3402.90,,,,',
    'KEON-DW-500,Dishwashing liquid,Other Brand,Lemon,500,ml,24,,,,,,,,,',
  ].join('\n');
  await page.getByTestId('sku-file').setInputFiles({ name: 'skus.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const counts = page.getByTestId('diff-counts');
  await expect(counts.locator('[data-kind="new"]')).toHaveAttribute('data-count', '1');
  await expect(counts.locator('[data-kind="changed"]')).toHaveAttribute('data-count', '1');
  await expect(counts.locator('[data-kind="conflict"]')).toHaveAttribute('data-count', '1');
  await page.getByRole('button', { name: /Apply new and changed/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Created 1, updated 1' })).toBeVisible();
  await goto(page, '/catalogue');
  await expect(page.getByText('KEON-DW-2L')).toBeVisible();
});

test('milestone 8: the capital-capped scenario returns a ranked plan with monthly cash need', async ({ page }) => {
  await goto(page, `/scenarios/${ids.scenario}`);
  await expect(page.getByText('Ranked plan')).toBeVisible();
  await expect(page.locator('[data-included="true"]').first()).toBeVisible();
  await expect(page.getByText('Monthly cash need')).toBeVisible();
  await expectAllNumsExplained(page);
});

test('milestone 7: Singapore chain has branches for Fortune, Prime and FoodMax', async ({ page }) => {
  await goto(page, `/supply-chain?market=${ids.SG}`);
  const view = page.getByTestId('supply-chain');
  for (const ch of ['Fortune', 'Prime', 'FoodMax']) await expect(view.getByRole('heading', { name: new RegExp(ch) })).toBeVisible();
  await view.getByRole('button', { name: '2D waterfall' }).click();
  await expect(view.getByTestId('waterfall-layers').first()).toBeVisible();
  const c = view.locator('.num[data-explain="contribution_per_unit"]').first();
  const before = await c.getAttribute('aria-label');
  await setRange(page, 'Channel margin', 0.1, view);
  await expect(c).not.toHaveAttribute('aria-label', before!);
});

test('bottom navigation tap targets are at least 44px', async ({ page }) => {
  await goto(page, '/home');
  const links = page.getByRole('navigation', { name: 'Main' }).last().getByRole('link');
  const n = await links.count();
  for (let i = 0; i < n; i++) {
    const box = await links.nth(i).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});
