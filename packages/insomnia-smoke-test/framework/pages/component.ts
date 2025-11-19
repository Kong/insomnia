import { Page } from '@playwright/test';

export abstract class Component {
  readonly page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }

  // actions
  async login(): Promise<void> {

  }


  // assertions
  async checkImHere(): Promise<void> {

  }

}
