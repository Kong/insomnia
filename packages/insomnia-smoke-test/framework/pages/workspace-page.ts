import { BasePage } from './base-page';
import { ImportDialog } from './import-dialog';

export class WorkspacePage extends BasePage {
  // locators
  private readonly addRequestButton = this.page.getByRole('button', { name: 'Create request collection' })

  // actions
  async addRequest(): Promise<void> {
    await this.addRequestButton.click();
  }

  async import(): Promise<void> {
    await this.addRequestButton.click();
  }

  // assertions
}
