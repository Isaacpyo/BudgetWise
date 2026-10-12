import { expect, test, type Page } from '@playwright/test';

async function openTab(page: Page, name: RegExp) {
  await page.getByRole('tab', { name }).click();
}

test('sign up, link a sandbox bank, recategorise with a rule, budget and chart it', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;

  // Sign up
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByTestId('submit-auth').click();

  // Empty state → link a bank through the (mock) Plaid Link flow
  await expect(page.getByText('Link your first bank')).toBeVisible();
  await page.getByTestId('link-first-bank').click();
  await expect(page.getByTestId('mock-bank-sheet')).toBeVisible();
  await page.getByRole('radio', { name: 'Tartan Bank' }).click();
  await page.getByTestId('mock-connect').click();
  await expect(page.getByTestId('link-success')).toContainText('Linked Tartan Bank');
  await expect(page.getByTestId('link-success')).toContainText(/Imported \d+ transactions/);

  // Transactions arrive through the Firestore listener. Tabs stay mounted,
  // so scope every lookup to the screen in front.
  await page.getByTestId('view-transactions').click();
  const list = page.getByTestId('transactions-list');
  await expect(list.getByTestId('transaction-row').first()).toBeVisible();

  // Recategorise a merchant and create a rule from it
  await list.getByLabel('Search').fill('Starbucks');
  const row = list.getByTestId('transaction-row').first();
  await expect(row).toContainText('Dining out');
  await row.click();
  await page.getByTestId('category-entertainment').click();
  await page.getByTestId('apply-to-all').click();
  await page.getByTestId('save-category').click();
  await expect(page.getByTestId('save-result')).toContainText('New rule "Starbucks"');
  await page.goto('/transactions');
  await list.getByLabel('Search').fill('Starbucks');
  await expect(list.getByTestId('transaction-row').first()).toContainText('Entertainment');
  await expect(list.getByTestId('transaction-row').first()).toContainText('Rule');

  // Set a monthly budget and see its progress
  await openTab(page, /Budgets/);
  const budgets = page.getByTestId('budgets');
  await budgets.getByTestId('add-budget-groceries').click();
  await budgets.getByTestId('budget-amount').fill('400');
  await budgets.getByTestId('save-budget').click();
  await expect(budgets.getByTestId('budget-groceries')).toContainText('of $400.00');
  await expect(budgets.getByRole('progressbar', { name: 'Groceries budget used' })).toBeVisible();

  // Charts render (Skia/CanvasKit lazy-loaded on web)
  await openTab(page, /Insights/);
  await expect(page.getByTestId('monthly-chart')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('pace-chart')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Where it went/ })).toBeVisible();

  // Sign out
  await openTab(page, /Accounts/);
  await expect(page.getByTestId('linked-item')).toContainText('Tartan Bank');
  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('try-demo')).toBeVisible();
});

test('one-click demo signs into the seeded demo account', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('try-demo').click();
  const overview = page.getByTestId('overview');
  await expect(overview).toContainText('Demo account');
  await expect(overview.getByTestId('stat-spent')).toBeVisible();
  await expect(overview.getByTestId('transaction-row').first()).toBeVisible();
});
