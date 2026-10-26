import { expect, test } from '@playwright/test';

const INITIAL_PASSWORD = 'Admin@12345';
const NEXT_PASSWORD = 'NovaSenha456';

test('admin entra, troca a senha obrigatória e chega à área logada sem scroll horizontal', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';

  await page.goto('/login');
  await page.getByLabel('E-mail').fill(adminEmail);
  await page.getByLabel('Senha').fill(INITIAL_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/change-password$/);

  await page.getByLabel('Senha atual').fill(INITIAL_PASSWORD);
  await page.getByLabel('Nova senha').fill(NEXT_PASSWORD);
  await page.getByRole('button', { name: 'Alterar senha' }).click();
  await page.waitForURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
