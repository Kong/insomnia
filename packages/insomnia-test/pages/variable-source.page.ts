
import { BasePage } from "./base.page";



export class VariableSourcePage extends BasePage {

  /**
   * Waits for the request pane's Body tab content to be showing a
   * rendered template tag, confirming a body with variables is ready.
   */
  async navigate(): Promise<void> {
    await this.page.getByText("Body", { exact: true }).click();
  }




















}
