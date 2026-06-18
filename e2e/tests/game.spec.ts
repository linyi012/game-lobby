import { expect, test } from '@playwright/test';
import { addBot, createRoom, loginAsGuest, playerListSection, unique } from './helpers';

test.describe('开始游戏', () => {
  test('房主与电脑可以开始德国心脏病', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'), 'german_heart_attack');

    await addBot(page);
    await expect(playerListSection(page).getByText(/电脑-/)).toHaveCount(1);

    await expect(async () => {
      await page.getByRole('button', { name: '开始游戏' }).click();
      await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible({
        timeout: 3000,
      });
      await expect(page.getByText('德国心脏病', { exact: true })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20_000 });

    await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible();
  });

  test('房主与电脑可以开始达芬奇密码', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'), 'da_vinci_code');

    await addBot(page);
    await expect(playerListSection(page).getByText(/电脑-/)).toHaveCount(1);

    await expect(async () => {
      await page.getByRole('button', { name: '开始游戏' }).click();
      await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible({
        timeout: 3000,
      });
      await expect(page.getByText('达芬奇密码', { exact: true })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20_000 });

    await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible();
  });

  test('房主与电脑可以开始狼人杀', async ({ page }) => {
    await loginAsGuest(page);
    await createRoom(page, unique('房间'), 'werewolf');

    for (let i = 0; i < 5; i++) {
      await addBot(page);
    }
    await expect(playerListSection(page).getByText(/电脑-/)).toHaveCount(5);

    await expect(async () => {
      await page.getByRole('button', { name: '开始游戏' }).click();
      await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible({
        timeout: 3000,
      });
      await expect(page.getByText('狼人杀', { exact: true })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20_000 });

    await expect(page.locator('.badge', { hasText: '游戏中' })).toBeVisible();
  });
});
