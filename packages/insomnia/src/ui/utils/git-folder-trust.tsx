import React from 'react';

import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';

/**
 * Ask the user to confirm they trust a folder before opening it as a Git project.
 *
 * Opening a folder imports the API collections, environments and lint rulesets it
 * contains. Collections can carry pre-request / after-response scripts that run
 * (in Insomnia's sandbox) when requests are sent. Insomnia uses isomorphic-git
 * rather than the native `git` binary, so opening a folder never executes git
 * hooks — but a folder from an untrusted source can still bring in unwanted
 * content, so we surface a one-time trust prompt. See GIT_LOCAL_REPOS_DESIGN.md.
 *
 * Resolves `true` when the user chooses to open, `false` if they cancel or dismiss.
 */
export const confirmOpenFolderTrust = (folderPath: string): Promise<boolean> =>
  new Promise(resolve => {
    showModal(AskModal, {
      title: 'Do you trust this folder?',
      yesText: 'Open folder',
      noText: 'Cancel',
      message: (
        <div className="flex flex-col gap-3 text-left">
          <p>Only open folders from a source you trust.</p>
          <p className="text-sm text-(--hl)">
            Insomnia will read this folder and import any API collections, environments and lint rulesets it contains.
            Collections can include pre-request and after-response scripts that run when you send their requests.
          </p>
          <div className="rounded-xs bg-(--hl-xxs) px-2 py-1 font-mono text-xs break-all text-(--color-font)">
            {folderPath}
          </div>
        </div>
      ),
      onDone: async (isYes: boolean) => resolve(isYes),
      onHide: () => resolve(false),
    });
  });
