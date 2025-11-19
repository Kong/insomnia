import { Component } from './component';
import { expect } from '@playwright/test';

export class BasePage extends Component {

    // locators
    private readonly homeButton = this.page.getByRole('link').filter({ hasText: /^$/ })
    private readonly welcomeLabel = this.page.getByText('Welcome to your project!Start')

    // actions
    async navigateBackHome(): Promise<void> {
        await this.homeButton.click()
    }

    // assertions
    async checkImHere():  Promise<void> {
        await expect(this.welcomeLabel).toBeVisible()
    }
}
