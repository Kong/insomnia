import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// tests/smoke/basic-request.test.ts

test('create a request -> send -> validation', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  // app: Electron 应用实例
  // page: 第一个窗口的页面对象
  
  console.log('等待应用启动...');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.getByTestId('response-pane');
  const inputFields = page.getByTestId('OneLineEditor');
  const urlInputField = inputFields.first();

  // // 检查页面是否包含 "Welcome to your project!" 文字
  // await expect.soft(page.getByText('Welcome to your project!')).toBeVisible();

  console.log('Create a request');
  await page.getByLabel('Create request collection').click();

  await urlInputField.click();
  await page.keyboard.type('https://httpbin.org/post');

  await page.getByRole('button', { name:"Request Method"}).click();
  await page.getByText('POST',{exact:true}).click();

  console.log('send the request');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"url": "https://httpbin.org/post"');
});



// test('完整流程：从零创建API请求 -> 配置 -> 发送 -> 验证', async ({ app, page }) => {
//   test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
//   // os || windows ； 测试标记，可以晚点看下慢测试的原因

// })

// testdata: https://httpbin.org/post

// withoutlogin - sendrequest
// click 'new http request' button  || shotkey ctrl + N
// switch to the method to 'post' 
// fill in the url "https://httpbin.org/post"
// click 'headers' label
// click 'add' button
// 
// click send

// test('user can create, send and validate an HTTP request', async ({ app, page }) => {
//   // 1. Import a simple collection (or create new request via UI)
//   // 2. Select request
//   // 3. Send request
//   // 4. Assert:
//   //    - status code
//   //    - response body
//   //    - response time / headers (optional)
// });

// Write a new test case to cover Insomnia’s main workflow involving creating, sending and 
// validating a request. (Adding extra configurations if necessary to make it closer to 
// real-word usage and your understanding of Insomnia features.) 
// 1. Test Result Reporting 
// 2. Continuous integration (run the tests in CI e.g. GitHub Actions) 
// 3. Additional test scenarios that you can think of. 

// 是否是在insomnia实现这个功能 -》 UI测试？
// 是否要写很多种情况 -》 从用户角度？


// from GPT：
// 加分点（选 1–2 个就够）

// 使用 environment variable

// 验证 response tab 切换

// 验证 request history
