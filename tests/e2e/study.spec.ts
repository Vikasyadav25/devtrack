import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }, info) => {
  if (info.title.startsWith('anonymous') || info.title.startsWith('email account')) return;
  const email = 'browser-learner@example.test',
    password = 'Browser test passphrase for DevTrack';
  const post = (path: string, data: unknown) =>
    page.request.post(`/api/v1${path}`, { data, headers: { Origin: 'http://127.0.0.1:5174' } });
  await post('/auth/register', { email, password });
  const login = await post('/auth/login', { email, password });
  if (login.status() !== 200) {
    const inbox = await (await post('/auth/dev-mail', { email })).json();
    const verify = inbox.messages.find((m: { purpose: string }) => m.purpose === 'verify');
    if (verify) {
      const token = new URLSearchParams(new URL(verify.link).hash.split('?')[1]).get('token');
      expect((await post('/auth/verify-email', { token })).status()).toBe(200);
    }
    expect((await post('/auth/login', { email, password })).status()).toBe(200);
  }
});
test('anonymous visitors see email login before the workspace', async ({ page }) => {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Sign in to continue.' }),
    }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your next chapter starts with you.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('Prep Hub exposes every track, exact practice links and free-resource filters on mobile', async ({
  page,
}) => {
  await page.goto('/#/prep-hub');
  await expect(page.getByRole('heading', { name: 'Prep Hub', exact: true })).toBeVisible();
  await expect(page.locator('.prep-course')).toHaveCount(6);
  await page.getByLabel('Search Prep Hub').fill('Two Sum');
  const practice = page.locator('.prep-resource').filter({ hasText: 'LeetCode · Two Sum' }).first();
  await expect(practice).toHaveAttribute('href', 'https://leetcode.com/problems/two-sum/');
  await expect(page.getByRole('link', { name: 'Study in DevTrack' }).first()).toBeVisible();
  await page.getByLabel('Search Prep Hub').fill('');
  await page.getByRole('button', { name: 'Core CS', exact: true }).click();
  await expect(page.locator('.prep-course')).toHaveCount(6);
  await page.getByLabel('Search Prep Hub').fill('Deadlock');
  await expect(
    page.getByText('Deadlock in Operating Systems', { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel('Search Prep Hub').fill('');
  await page.getByRole('button', { name: 'System Design', exact: true }).click();
  await expect(page.locator('.prep-course')).toHaveCount(2);
  await page.getByRole('button', { name: 'Data Engineering', exact: true }).click();
  await expect(page.locator('.prep-course')).toHaveCount(2);
  await page.getByLabel('Search Prep Hub').fill('Top 3 Salaries');
  await expect(
    page.locator('.prep-resource').filter({ hasText: 'Department Top Three Salaries' }).first(),
  ).toHaveAttribute('href', 'https://leetcode.com/problems/department-top-three-salaries/');
  await page.getByLabel('Free resources', { exact: true }).check();
  await expect(page.locator('.prep-resource').filter({ hasText: 'Premium' })).toHaveCount(0);
  await expect(
    page.locator('.prep-resource').filter({ hasText: 'PostgreSQL' }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Search Prep Hub').fill('no-such-topic-xyz');
  await expect(page.getByText('No topics match these filters.', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Search Prep Hub')).toHaveValue('no-such-topic-xyz');
  await page.getByLabel('Search Prep Hub').fill('');
  await page.screenshot({ path: 'test-results/prep-hub-mobile.png', fullPage: true });
});
test('email account registration, verification, login and password reset work end to end', async ({
  page,
}) => {
  const email = `email-${Date.now()}@example.test`,
    password = 'An initial browser passphrase',
    next = 'A different browser passphrase';
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create your account', exact: true }).click();
  await page.getByRole('button', { name: 'Open local email preview' }).click();
  await page.getByRole('link', { name: /Verify email address/ }).click();
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByText('Email verified. You can now sign in.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A little progress. A stronger you.' }),
  ).toBeVisible();
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await page.getByRole('button', { name: 'Open local email preview' }).click();
  await page.getByRole('link', { name: /Reset password/ }).click();
  await page.getByLabel('New password', { exact: true }).fill(next);
  await page.getByLabel('Confirm password').fill(next);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Password updated. Sign in with your new password.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(next);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A little progress. A stronger you.' }),
  ).toBeVisible();
});
test('notes CRUD, bookmarks and backup import work through the browser', async ({ page }) => {
  const title = `Browser note ${Date.now()}`;
  await page.goto('/#/dsa/arrays-hashing');
  const bookmark = page.getByRole('button', { name: /^(Bookmark topic|Remove bookmark)$/ });
  await expect(bookmark).toBeEnabled();
  if ((await bookmark.innerText()) === 'Bookmark topic') await bookmark.click();
  await expect(page.getByRole('button', { name: 'Remove bookmark', exact: true })).toBeVisible();
  await page.goto('/#/notes');
  await expect(page.getByRole('heading', { name: 'Bookmarked for later' })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Your note').fill('**Invariant:** the prefix is processed.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const card = page
    .locator('.note-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await expect(card.locator('strong')).toHaveText('Invariant:');
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Your note').fill('Revised reasoning.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(card).toContainText('Revised reasoning.');
  const exported = await (await page.request.get('/api/v1/export')).json();
  await page.goto('/#/settings');
  await page.getByLabel('Choose a DevTrack JSON backup').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByText('Saved to your workspace.')).toBeVisible();
  await page.goto('/#/notes');
  await page
    .locator('.note-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
});
test('study, record an independent attempt, persist on mobile and export', async ({ page }) => {
  const note = `Window reasoning ${Date.now()}: update incoming and outgoing contributions.`;
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A little progress. A stronger you.' }),
  ).toBeVisible();
  await page.goto('/#/dsa/sliding-window');
  await expect(page.getByRole('heading', { name: 'Sliding window', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Java template' })).toBeVisible();
  await page.getByRole('link', { name: /Maximum Average Subarray I/ }).click();
  await expect(page.getByRole('link', { name: /Open problem/ })).toHaveAttribute(
    'target',
    '_blank',
  );
  await page.getByLabel('Outcome').selectOption('solved');
  await page.getByLabel('Focused minutes').fill('18');
  await page.getByLabel('What did you learn?').fill(note);
  await page.getByRole('button', { name: 'Save attempt & schedule review' }).click();
  await expect(page.getByText('Saved to your workspace.')).toBeVisible();
  const response = await page.request.get('/api/v1/progress');
  expect((await response.json()).some((x: { item_id: string }) => x.item_id === 'lc-643')).toBe(
    true,
  );
  const state = await page.request.get('/api/v1/export');
  const backup = await state.json();
  expect(
    backup.data.review_state.some(
      (x: { item_id: string; interval_days: number }) =>
        x.item_id === 'lc-643' && x.interval_days === 1,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/#/settings');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my workspace' }).click();
  expect((await downloaded).suggestedFilename()).toBe('devtrack-backup.json');
  await page.getByRole('heading', { name: 'Your pace. Your preferences.' }).click();
  await page.screenshot({ path: 'test-results/mobile-settings.png', fullPage: true });
});
test('search, Java copy, HLD diagram, dark mode and accessible mobile navigation', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/java/equality-and-hashing');
  await page.getByRole('button', { name: 'Copy code', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Copy code', exact: true }).first()).toContainText(
    'Copied',
  );
  await page.goto('/#/hld/url-shortener');
  await expect(page.getByRole('heading', { name: 'Baseline design' })).toBeVisible();
  await page.getByRole('button', { name: 'Render architecture diagram' }).click();
  await expect(page.getByRole('img', { name: 'Architecture diagram' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Search curriculum').fill('binary');
  await page.getByLabel('Search curriculum').press('Enter');
  await expect(page.getByRole('heading', { name: 'Binary search', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'My notes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Keep the ideas that click.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('dashboard desktop layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your focus for today' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
});
