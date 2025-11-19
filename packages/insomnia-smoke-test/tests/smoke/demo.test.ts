import { expect } from '@playwright/test';
import { RequestBuilderWf } from '../../framework/workflow/request-builder-wf';
import { FileHelper } from '../../framework/utils/file-helper';
import path from 'path';
import { test } from '../../playwright/test';


test.describe('Request Functionality', () => {
  let requestBuilderWf: RequestBuilderWf;
  let testData;
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  test.beforeAll(async() => {
    testData = await FileHelper.loadSmokeTestData(path.basename(__filename).split('.')[0])
    
  })

  test.beforeEach(async ({ page, app }) => {
    requestBuilderWf = new RequestBuilderWf(page); 
  });

  test('T001 check request with prerequest can create and send', async () => {
    await requestBuilderWf.addGetRequest("T001_check_pre_request", testData.T001)
    // check status 200
    await requestBuilderWf.checkResponse(testData.status, testData.body, testData.previewBody)
  });

  
});
