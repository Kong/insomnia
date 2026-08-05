import type { FC } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';

import { CopyButton } from '../base/copy-button';
import { Icon } from '../icon';

interface Props {
  trackingRemote: string;
  remoteUrl: string | null;
  currentBranch: string;
}

export const GitNonOriginBranchBanner: FC<Props> = ({ currentBranch }) => {
  return (
    <div className="flex w-full items-center gap-3 bg-[rgba(var(--color-warning-rgb),0.1)] px-3 py-1.5 text-xs text-(--color-font)">
      <Icon icon="triangle-exclamation" className="shrink-0 text-(--color-warning)" />
      <span className="min-w-0 flex-1 wrap-break-word whitespace-normal">
        This branch tracks a non-origin remote which is currently unsupported in Insomnia
      </span>
      <DialogTrigger>
        <Button className="flex items-center justify-center gap-2 rounded-sm px-4 py-1 text-sm text-(--color-font) ring-1 ring-(--hl) transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
          How to fix
        </Button>
        <Popover
          offset={8}
          placement="bottom end"
          className="max-h-[85vh] max-w-xl overflow-y-auto rounded-md border border-solid border-(--hl-md) bg-(--color-bg) p-6 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
        >
          <Dialog className="focus:outline-hidden">
            <Heading className="mb-4 text-xl font-semibold text-(--color-font)">Set branch upstream to origin</Heading>
            <p className="mb-4 max-w-2xl text-base">
              To continue pushing and pulling to the remote repo with this branch, complete the following steps using
              the git CLI:
            </p>
            <ol className="space-y-6">
              <li>
                <div className="mb-2 flex items-baseline gap-3 font-semibold text-(--color-font)">
                  <span>1.</span>
                  <p>Re-point to origin</p>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-(--hl-xs) px-5 py-4">
                  <code className="min-w-0 flex-1 border-none bg-transparent wrap-break-word whitespace-normal select-text">
                    git branch --set-upstream-to=origin/{currentBranch}
                  </code>
                  <CopyButton
                    size="small"
                    confirmMessage=""
                    content={`git branch --set-upstream-to=origin/${currentBranch}`}
                    title="Copy command"
                    style={{ borderWidth: 0, padding: 0 }}
                    className="shrink-0 rounded-xl border border-solid border-(--hl-md) bg-(--color-bg) p-2.5"
                  >
                    <i className="fa fa-copy" />
                  </CopyButton>
                </div>
              </li>
              <li>
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="font-semibold text-(--color-font)">2.</span>
                  <p className="font-semibold text-(--color-font)">Push to origin</p>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-(--hl-xs) px-5 py-4">
                  <code className="min-w-0 flex-1 border-none bg-transparent wrap-break-word whitespace-normal select-text">
                    git push origin {currentBranch}
                  </code>
                  <CopyButton
                    size="small"
                    confirmMessage=""
                    content={`git push origin ${currentBranch}`}
                    title="Copy command"
                    style={{ borderWidth: 0, padding: 0 }}
                    className="shrink-0 rounded-xl border border-solid border-(--hl-md) bg-(--color-bg) p-10"
                  >
                    <i className="fa fa-copy" />
                  </CopyButton>
                </div>
              </li>
            </ol>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
};
