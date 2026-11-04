import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { CopyButton } from '../base/copy-button';
import { Link } from '../base/link';
import { Icon } from '../icon';
import { INSO_CLI_DOCS_URL } from './cli-preview-modal';

export const LintCLIModal = ({
  onClose,
  workspaceId,
  rulesetPath,
}: {
  onClose: () => void;
  workspaceId: string;
  rulesetPath?: string;
}) => {
  const rulesetArgument = rulesetPath ? ` --ruleset "${rulesetPath}"` : '';
  const cliCommand = `inso lint spec ${workspaceId.slice(0, 10)}${rulesetArgument}`;

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-start justify-center bg-black/30"
    >
      <Modal className="m-24 flex max-h-[75%] w-full max-w-[75%] flex-col overflow-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Lint via CLI
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="h-full w-full flex-row p-2">
                <div className="pb-4">Copy this command to lint your spec in the terminal</div>
                <div className="flex max-h-32 min-h-[2em] flex-col overflow-y-auto border border-solid border-(--hl-sm) bg-(--hl-xs) px-2 py-1">
                  <div className="relative flex h-full w-full justify-between gap-(--padding-sm) overflow-auto font-mono">
                    <span>{cliCommand}</span>
                    <CopyButton
                      size="small"
                      content={cliCommand}
                      title="Copy Command"
                      confirmMessage=""
                      className="sticky top-0 self-start"
                    >
                      <i className="fa fa-copy" />
                    </CopyButton>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Link href={INSO_CLI_DOCS_URL} className="underline">
                  Learn more about Inso CLI
                </Link>
                <Button
                  className="flex items-center gap-2 rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--hl) transition-colors hover:no-underline"
                  onPress={close}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
