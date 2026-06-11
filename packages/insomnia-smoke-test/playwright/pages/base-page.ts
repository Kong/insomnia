import type { Page } from '@playwright/test';

import { ExportModal } from './components/export-modal';
import { StatusbarComponent } from './components/statusbar';

export class BasePage {
  readonly statusbar: StatusbarComponent;
  readonly exportModal: ExportModal;

  constructor(readonly page: Page) {
    this.statusbar = new StatusbarComponent(page);
    this.exportModal = new ExportModal(page);
  }
}
