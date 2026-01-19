import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Page } from 'playwright';
import { startElectronApp, closeElectronApp } from '../vitest/electron-app';

describe('UI test for http requests', () => {
  let page: Page;

  // 在所有测试开始前启动应用
  beforeAll(async () => {
    const { page: appPage } = await startElectronApp();
    page = appPage;
  });

  // 在所有测试结束后关闭应用
  afterAll(async () => {
    await closeElectronApp();
  });

  // 辅助函数: 选择 HTTP 方法
  async function selectMethod(method: string) {
    console.log(`选择 ${method} 方法`);
    const methodDropdown = page.locator('button[aria-label="Request Method"]').first();
    await methodDropdown.click();
    await page.waitForTimeout(300);

    const methodOption = page.locator(`[class*="http-method-${method}"]`).filter({ hasText: method }).first();
    await methodOption.click();
    await page.waitForTimeout(300);

    const dropdownText = await methodDropdown.textContent();
    expect(dropdownText).toContain(method);
    console.log(`✓ 已选择 ${method} 方法`);
  }

  // 辅助函数: 输入 URL
  async function setUrl(url: string) {
    console.log(`输入 URL: ${url}`);
    const urlInput = page.locator('input[placeholder*="URL"]').first();
    await urlInput.click();
    await urlInput.fill(url);
    const inputValue = await urlInput.inputValue();
    expect(inputValue).toBe(url);
    console.log('✓ URL 已输入');
  }

  // 辅助函数: 添加查询参数
  async function addQueryParams(params: Record<string, string>) {
    console.log('添加查询参数');
    const queryTab = page.getByRole('tab', { name: /query/i });
    await queryTab.click();
    await page.waitForTimeout(500);

    const nameInputs = page.locator('input[placeholder="Name"]');
    const valueInputs = page.locator('input[placeholder="Value"]');

    let index = 0;
    for (const [key, value] of Object.entries(params)) {
      await nameInputs.nth(index).click();
      await nameInputs.nth(index).fill(key);
      await valueInputs.nth(index).click();
      await valueInputs.nth(index).fill(value);
      console.log(`✓ 已添加参数: ${key}=${value}`);
      index++;
    }
  }

  // 辅助函数: 发送请求并验证响应
  async function sendAndVerify() {
    console.log('发送请求');
    const sendButton = page.getByTestId('request-pane').getByRole('button', { name: 'Send' });
    await sendButton.click();
    console.log('✓ 已点击 Send 按钮');

    const statusTag = page.locator('[data-testid="response-status-tag"]');
    await statusTag.waitFor({ state: 'visible', timeout: 15000 });

    const statusText = await statusTag.textContent();
    console.log(`✓ 响应状态码: ${statusText}`);

    return statusText;
  }

  // 测试 GET 方法
  it('GET request with query parameters', async () => {
    console.log('\n========== GET 请求测试 ==========');

    await selectMethod('GET');
    await setUrl('http://127.0.0.1:4010/gettest');
    await addQueryParams({ name: 'xiaoming', age: '20' });
    await sendAndVerify();

    console.log('✅ GET 测试完成\n');
  });

  // 测试 POST 方法（带 JSON Body）
  it('POST request with query parameters and JSON body', async () => {
    console.log('\n========== POST 请求测试 ==========');

    await selectMethod('POST');
    await setUrl('http://127.0.0.1:4010/posttest');
    await addQueryParams({ name: 'xiaoming', age: '20' });

    // 切换到 Body 标签
    console.log('切换到 Body 标签');
    const bodyTab = page.getByRole('tab', { name: /body/i });
    await bodyTab.click();
    await page.waitForTimeout(500);

    // 选择 JSON
    console.log('选择 JSON 格式');
    const jsonButton = page.getByRole('button', { name: /json/i }).first();
    if (await jsonButton.isVisible().catch(() => false)) {
      await jsonButton.click();
      await page.waitForTimeout(300);
      console.log('✓ 已选择 JSON 格式');
    }

    await sendAndVerify();

    console.log('✅ POST 测试完成\n');
  });

  // 测试 PUT 方法
  it('PUT request with query parameters', async () => {
    console.log('\n========== PUT 请求测试 ==========');

    await selectMethod('PUT');
    await setUrl('http://127.0.0.1:4010/puttest');
    await addQueryParams({ name: 'xiaoming', age: '20' });
    await sendAndVerify();

    console.log('✅ PUT 测试完成\n');
  });

  // 测试 PATCH 方法
  it('PATCH request with query parameters', async () => {
    console.log('\n========== PATCH 请求测试 ==========');

    await selectMethod('PATCH');
    await setUrl('http://127.0.0.1:4010/patchtest');
    await addQueryParams({ name: 'xiaoming', age: '20' });
    await sendAndVerify();

    console.log('✅ PATCH 测试完成\n');
  });

  // 测试 DELETE 方法
  it('DELETE request with query parameters', async () => {
    console.log('\n========== DELETE 请求测试 ==========');

    await selectMethod('DELETE');
    await setUrl('http://127.0.0.1:4010/deletetest');
    await addQueryParams({ name: 'xiaoming', age: '20' });
    await sendAndVerify();

    console.log('✅ DELETE 测试完成\n');
  });

  // 测试 OPTIONS 方法
  it('OPTIONS request with query parameters', async () => {
    console.log('\n========== OPTIONS 请求测试 ==========');

    await selectMethod('OPTIONS');
    await setUrl('http://127.0.0.1:4010/optionstest');
    await addQueryParams({ name: 'xiaoming', age: '20' });
    await sendAndVerify();

    console.log('✅ OPTIONS 测试完成\n');
  });

  // 测试 HEAD 方法
  it('HEAD request with query parameters', async () => {
    console.log('\n========== HEAD 请求测试 ==========');

    await selectMethod('HEAD');
    await setUrl('http://127.0.0.1:4010/headtest');
    await addQueryParams({ name: 'xiaoming', age: '20' });
    await sendAndVerify();

    console.log('✅ HEAD 测试完成\n');
  });
});

