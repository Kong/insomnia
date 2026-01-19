import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { _electron as electron } from 'playwright';

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

let electronApp: ElectronApplication | null = null;
let page: Page | null = null;

/**
 * 启动 Electron 应用
 */
export async function startElectronApp(): Promise<{ app: ElectronApplication; page: Page }> {
  if (electronApp) {
    return { app: electronApp, page: page! };
  }

  console.log('🚀 启动 Electron 应用...');
  
  electronApp = await electron.launch({
    cwd,
    executablePath: electronBinary,
    args: [mainPath],
    env: {
      ...process.env,
      INSOMNIA_SKIP_ONBOARDING: 'true',
      NODE_ENV: 'test',
    },
  });

  // 等待应用启动并获取主窗口
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('.app', { state: 'visible', timeout: 30000 });

  console.log('✅ Electron 应用已启动');

  return { app: electronApp, page };
}

/**
 * 关闭 Electron 应用
 */
export async function closeElectronApp(): Promise<void> {
  if (electronApp) {
    console.log('🔒 关闭 Electron 应用...');
    await electronApp.close();
    electronApp = null;
    page = null;
    console.log('✅ Electron 应用已关闭');
  }
}

/**
 * 获取当前的 Electron 应用实例
 */
export function getElectronApp(): ElectronApplication | null {
  return electronApp;
}

/**
 * 获取当前的页面实例
 */
export function getPage(): Page | null {
  return page;
}

