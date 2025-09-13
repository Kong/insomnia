import { expect, test } from '@playwright/test'; // 导入 Playwright 的 test 和 expect 函数

import { TestRunner } from '../../common/test-runner';

// 使用 test 函数定义一个测试用例，名称为 'basic test'
TestRunner.run('basic test', async ({ page }) => { // 测试函数接收一个包含 page  fixture 的对象
    await page.goto('https://playwright.dev/');

    await expect(page).toHaveTitle(/Playwright/);
});
