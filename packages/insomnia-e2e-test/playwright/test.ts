/* eslint-disable no-empty-pattern */
// Read more about creating fixtures https://playwright.dev/docs/test-fixtures
import path from 'node:path';

import type { ElectronApplication } from '@playwright/test';
import { _electron as electron, test as baseTest } from '@playwright/test';

// 获取 Insomnia 项目路径
const cwd = path.resolve(__dirname, '..', '..', 'insomnia');
const repoRoot = path.resolve(__dirname, '..', '..', '..');

// Electron 可执行文件路径
const electronBinary = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron',
);

// 主入口文件路径（开发模式）
const mainPath = path.join('src', 'entry.main.min.js');

export const test = baseTest.extend<{
  app: ElectronApplication;
}>({
  app: async ({ }, use) => {
    // 启动 Electron 应用
    const electronApp = await electron.launch({
      cwd,
      executablePath: electronBinary,
      args: [mainPath],
      env: {
        ...process.env,
        INSOMNIA_SKIP_ONBOARDING: 'true', // 跳过引导页
        NODE_ENV: 'test',
      },
    });

    // 等待应用启动
    await electronApp.firstWindow();

    await use(electronApp);

    // 测试结束后关闭应用
    await electronApp.close();
  },
});

export { expect } from '@playwright/test';

