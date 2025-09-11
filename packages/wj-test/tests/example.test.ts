import { expect, test } from '@playwright/test'; // 导入 Playwright 的 test 和 expect 函数

// 使用 test 函数定义一个测试用例，名称为 'basic test'
test('basic test', async ({ page }) => { // 测试函数接收一个包含 page  fixture 的对象
    // 使用 page fixture 导航到 Playwright 官网
    await page.goto('https://playwright.dev/');

    // 定位页面上的某个元素（这里以导航栏标题为例，选择器可能需要根据实际页面调整）
    // 更可靠的实践是使用 getByRole, getByText 等定位方式
    const title = page.locator('.navbar__inner .navbar__title');

    // 断言该元素的内容是否为 'Playwright'
    await expect(title).toHaveText('Playwright');
});
