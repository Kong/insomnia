import type { Page } from "@playwright/test";

import { DropdownComponent } from "./dropdown.component";

/**
 * Git / Insomnia sync dropdown (`dropdowns/git-sync-dropdown.tsx`,
 * `sync-dropdown.tsx`). Trigger is `data-testid="git-dropdown"`
 * (`aria-label="Git Sync"`); menu items are labelled by action
 * ("Commit", "Branches", "History", "Push", "Pull"…).
 */
export class SyncDropdownComponent extends DropdownComponent {
  constructor(page: Page) {
    super(page, page.getByTestId("git-dropdown"));
  }

  override get menu() {
    return this.page.getByRole("menu", { name: /(Git|Insomnia) Sync Menu/ });
  }

  async choose(action: string | RegExp): Promise<void> {
    await this.select(action);
  }

  async label(): Promise<string> {
    return (await this.root.innerText()).trim();
  }
}
