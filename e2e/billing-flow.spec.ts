import { expect, test } from '@playwright/test';

// Main flow: sign up → add client → add project → log hours → generate invoice → see the total.
test('a new user can bill a client for logged hours', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

  await test.step('sign up', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('password-123');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByTestId('user-email')).toHaveText(email);
  });

  await test.step('add a client', async () => {
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByLabel('Name').fill('Acme Ltd');
    await page.getByLabel('Email').fill('billing@acme.test');
    await page.getByRole('button', { name: 'Add client' }).click();
    await expect(page.getByRole('heading', { name: 'Acme Ltd' })).toBeVisible();
  });

  await test.step('add a project', async () => {
    await page.getByLabel('Project name').fill('Website redesign');
    await page.getByLabel('Hourly rate ($)').fill('50');
    await page.getByLabel('Budget (hours)').fill('40');
    await page.getByRole('button', { name: 'Add project' }).click();
    await expect(page.getByRole('heading', { name: 'Website redesign' })).toBeVisible();
  });

  await test.step('log billable and non-billable hours', async () => {
    const log = async (hours: string, description: string, billable: boolean) => {
      await page.getByLabel('Hours', { exact: true }).fill(hours);
      await page.getByLabel('Description').fill(description);
      await page.getByLabel('Billable').setChecked(billable);
      await page.getByRole('button', { name: 'Log hours' }).click();
      await expect(page.getByRole('cell', { name: description })).toBeVisible();
    };
    await log('2', 'Discovery workshop', true);
    await log('3', 'Wireframes', true);
    await log('4', 'Internal admin', false);
  });

  await test.step('generate the invoice and see the total', async () => {
    await page.getByRole('link', { name: 'Acme Ltd' }).click();
    await page.getByLabel('Tax rate (%)').fill('16');
    await page.getByRole('button', { name: /Generate invoice/ }).click();

    await expect(page.getByRole('heading', { name: 'Invoice INV-0001' })).toBeVisible();
    // 5 billable hours × $50 = $250, + 16% tax = $290. The 4 non-billable hours are excluded.
    await expect(page.getByTestId('invoice-total')).toHaveText('$290.00');
  });

  await test.step('the dashboard shows it as billed', async () => {
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('tile-billed')).toHaveText('$290.00');
    await expect(page.getByTestId('tile-unbilled')).toHaveText('$0.00');
  });
});

test('signed-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/clients');
  await expect(page).toHaveURL(/\/login$/);
});
