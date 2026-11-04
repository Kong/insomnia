import { BasePage } from "./base.page";

/**
 * Cloud Sync at the project-dashboard / toolbar level: the sync dropdown
 * (pull, discard) and the entry points to its modals. The modals are
 * `CloudSyncCommitDialogPage`, `CloudSyncHistoryDialogPage` and
 * `CloudSyncBranchesDialogPage`; file deletion is `CloudSyncFileDeletePage`.
 */
export class CloudSyncPage extends BasePage {
  navigate(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // Cloud Sync's sync dropdown reuses the exact same testid/aria-label as
  // Git Sync's (both `sync-dropdown.tsx` and
  // `git-sync-dropdown.tsx` render `data-testid="git-dropdown"`,
  // `aria-label="Git Sync"` — which one mounts depends on whether the
  // active workspace's project is Cloud-synced or has a git repo attached).
}
