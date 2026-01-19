import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html'], ['list']], // 生成 HTML 报告 + 控制台

    use: {
        trace: 'on-first-retry', // 出错时记录 trace
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        headless: true, // CI 用 headless，开发可改 false
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // 如果需要全局超时
    timeout: 60000,
    expect: {
        timeout: 10000,
    },
});