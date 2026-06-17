import { test, expect } from '@playwright/test';
import { loginAsGuest, createRoomAndWait } from './helpers';

test.describe('draw guess game', () => {
  test('two players can start draw guess room', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await loginAsGuest(hostPage, '画家A');
    await loginAsGuest(guestPage, '猜家B');

    const roomUrl = await createRoomAndWait(hostPage, 'draw_guess', '你画我猜测试房');
    await guestPage.goto(roomUrl);

    await expect(guestPage.getByText('你画我猜测试房')).toBeVisible({ timeout: 15_000 });

    await hostPage.getByRole('button', { name: '开始游戏' }).click();

    await expect(hostPage.getByText(/选词阶段|请选择要画的词语/)).toBeVisible({
      timeout: 15_000,
    });

    await hostContext.close();
    await guestContext.close();
  });
});
