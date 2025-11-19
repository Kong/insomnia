import { Component } from './component';
import { expect } from '@playwright/test';

export class BaseDialog extends Component {

    // locators 
    // TODO
    private readonly titleText = this.page.getByRole('link').filter({ hasText: /^$/ })

    // actions
    

    // assertions
    async checkTitle(expectedTitle: string):  Promise<void> {
        await expect(this.titleText).toContainText(expectedTitle)
    }
}
