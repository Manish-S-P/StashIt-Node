import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-password-123';
const uniqueTitle = (label: string) => `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function createStash(page: Page, title: string, { burn = false } = {}) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  if (burn) await page.getByLabel('Burn after read').check();
  await page.getByRole('button', { name: 'Create stash' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

async function openStash(page: Page, title: string) {
  await page.goto('/');
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Open stash' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

async function addFile(page: Page, name: string, content: string) {
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from(content),
  });
  await expect(page.getByRole('list', { name: 'Files in this stash' }).getByText(name)).toBeVisible();
}

test('create a stash, upload, open it elsewhere, download and delete', async ({ page, browser }, testInfo) => {
  const title = uniqueTitle('e2e');
  await createStash(page, title);
  await expect(page.getByText('No files yet')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('1-new-stash.png'), fullPage: true });

  await addFile(page, 'hello.txt', 'hello from the end-to-end test');
  await page.screenshot({ path: testInfo.outputPath('2-file-uploaded.png'), fullPage: true });

  // Someone else, in a separate browser, opens the stash with the same credentials.
  const other = await (await browser.newContext()).newPage();
  await openStash(other, title.toUpperCase());
  await expect(other.getByText('hello.txt')).toBeVisible();

  const downloadPromise = other.waitForEvent('download');
  await other.getByRole('button', { name: 'Download', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('hello.txt');

  // The creator deletes it.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('3-confirm-delete.png'), fullPage: true });
  await page.getByRole('button', { name: 'Delete file' }).click();
  await expect(page.getByText('No files yet')).toBeVisible();
});

test('a taken title shows a clear message', async ({ page }, testInfo) => {
  const title = uniqueTitle('taken');
  await createStash(page, title);
  await page.getByRole('button', { name: 'Close stash' }).click();

  await page.getByRole('tab', { name: 'Create', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Password', { exact: true }).fill('another-password');
  await page.getByRole('button', { name: 'Create stash' }).click();
  await expect(page.getByText('A stash with this title already exists')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('title-taken.png'), fullPage: true });
});

test('wrong password is rejected', async ({ page }) => {
  const title = uniqueTitle('locked');
  await createStash(page, title);
  await page.getByRole('button', { name: 'Close stash' }).click();

  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: 'Open stash' }).click();
  await expect(page.getByText('Wrong title or password')).toBeVisible();
});

test('burn after read: the first download locks everyone else out', async ({ page, browser }, testInfo) => {
  const title = uniqueTitle('burn');
  await createStash(page, title, { burn: true });
  await expect(page.getByText('Burn after read is on.')).toBeVisible();
  await addFile(page, 'secret.txt', 'read me once');

  const reader = await (await browser.newContext()).newPage();
  await openStash(reader, title);
  await reader.getByRole('button', { name: 'Download', exact: true }).click();
  await reader.screenshot({ path: testInfo.outputPath('burn-confirm.png'), fullPage: true });

  const downloadPromise = reader.waitForEvent('download');
  await reader.getByRole('button', { name: 'Download and burn' }).click();
  await downloadPromise;
  await expect(reader.getByText('You downloaded first')).toBeVisible();
  await reader.screenshot({ path: testInfo.outputPath('burned-reader.png'), fullPage: true });

  // The creator's view now shows the stash as burned.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'This stash was burned' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('burned-creator.png'), fullPage: true });
});
