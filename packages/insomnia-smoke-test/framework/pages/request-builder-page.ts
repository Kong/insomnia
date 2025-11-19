// pages/LoginPage.ts
import { BasePage } from './base-page';
import { Locator, expect } from '@playwright/test';

export class RequestBuilderPage extends BasePage {
  // locators
  private readonly urlInput = this.page.getByTestId('request-pane').locator('header').getByRole('textbox');

  private readonly paramtersTab = this.page.getByText('Params');
  private readonly queryParameterAddButton = this.page.getByLabel('NewRequest');
  private readonly queryParameterKeyInput = this.page.getByLabel('NewRequest');
  private readonly queryParameterValueInput = this.page.getByLabel('NewRequest');

  private readonly scriptsTab = this.page.getByLabel('NewRequest');
  private readonly preScriptAddButton = this.page.getByLabel('NewRequest');
  private readonly preScriptInput = this.page.getByLabel('NewRequest');

  private readonly sendButton = this.page.getByRole('button', { name: 'Send' });

  private readonly responseStatusTag = this.page.locator('[data-testid="response-status-tag"]:visible');
  private readonly responseBody = this.page.getByTestId('response-pane');
  private readonly responsePreviewButton = this.page.getByRole('button', { name: 'Preview' })
  private readonly responseRawDataMenuitem = this.page.getByRole('menuitem', { name: 'Raw Data' })

  // actions
  async selectRequest(requestName: string): Promise<void> {
    const requestItem = this.page.getByTestId(requestName).getByText(requestName);
    await requestItem.click()
  }

  async renameRequest(newName:string, oldName="My first request"): Promise<void> {
    const requestItem = this.page.getByTestId(oldName).getByText(oldName);
    await requestItem.dblclick()
    await requestItem.fill(newName)
    await requestItem.press('Enter')
  }

  async fillUrl(url: string): Promise<void> {
    await this.urlInput.fill(url)
  }

  async switchTabIfNecessary(tab: Locator): Promise<void> {
    const isTabActive = await tab.evaluate(element => {
      return element.classList.contains('active');
    });
    if (!isTabActive) await this.paramtersTab.click()

  }

  async addQueryParameter(param_key: string, param_value: string): Promise<void> {
    await this.switchTabIfNecessary(this.paramtersTab)
    await this.queryParameterAddButton.click()
    await this.queryParameterKeyInput.click()
    await this.queryParameterKeyInput.fill(param_key)
    await this.queryParameterValueInput.click()
    await this.queryParameterValueInput.fill(param_value)
  }
  
  async addPreScript(scriptStr: string): Promise<void> {
    await this.switchTabIfNecessary(this.scriptsTab)
    await this.preScriptAddButton.click()
    await this.preScriptInput.fill(scriptStr)
  }
  
  async addAfterScript(script: string): Promise<void> {

  }

  async sendRequest(): Promise<void> {
    await this.sendButton.click()
  }

  // assertion
  async checkResponseStatus(expected = '200 OK'): Promise<void> {
    await expect.soft(this.responseStatusTag).toContainText(expected);
  }

  async checkResponseBody(expected: string): Promise<void> {
      await expect.soft(this.responseBody).toContainText(expected);
  }

  async checkResponseRawData(expected: string): Promise<void> {
      await this.responsePreviewButton.click();
      await this.responseRawDataMenuitem.click();
      await expect.soft(this.responseBody).toContainText(expected);
  }
}
