import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    outputDir: './test-results',
    timeout: 30 * 1000,
    expect: { timeout: 5000 },
    fullyParallel: true,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'test-results/html' }],
        ['junit', { outputFile: 'test-results/results.xml' }]
    ],
    use: {
        baseURL: 'insomnia://',
        storageState: 'test-data/storage.json',
        trace: 'on-first-retry',
        video: 'on-first-retry'
    },
    projects: [
        {
            name: 'chromium',
            use: {
                channel: 'chrome',
                launchOptions: {
                    args: [
                        `--user-data-dir=${process.env.INSOMNIA_DATA_PATH}`,
                        '--disable-extensions',
                        '--disable-sync'
                    ]
                }
            }
        }
    ]
});