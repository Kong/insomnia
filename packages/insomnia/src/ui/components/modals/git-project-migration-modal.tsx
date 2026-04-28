import React, { type FC } from 'react';
import {
  Button,
  Cell,
  Column,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
  Row,
  Table,
  TableBody,
  TableHeader,
} from 'react-aria-components';
import { useParams } from 'react-router';

import type { WorkspaceScope } from '~/insomnia-data';
import { useGitProjectMigrateLegacyInsomniaFolderActionFetcher } from '~/routes/git.migrate-legacy-insomnia-folder-to-file';

import {
  scopeToBgColorMap,
  scopeToIconMap,
  scopeToLabelMap,
  scopeToTextColorMap,
} from '../../../common/get-workspace-label';
import { Icon } from '../icon';

export const GitProjectMigrationModal: FC<{
  onClose: () => void;
  legacyFile: { name: string; scope: WorkspaceScope; path: string };
}> = ({ onClose, legacyFile }) => {
  const { projectId } = useParams() as {
    projectId: string;
  };

  const migrateLegacyWorkspaceFetcher = useGitProjectMigrateLegacyInsomniaFolderActionFetcher();

  const migrateLegacyWorkspace = () => {
    migrateLegacyWorkspaceFetcher.submit({
      projectId,
    });
  };

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex max-h-[90dvh] min-h-[420px] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font)"
      >
        <Dialog
          data-loading={migrateLegacyWorkspaceFetcher.state === 'loading' ? 'true' : undefined}
          className="flex h-full flex-1 flex-col overflow-hidden px-10 pt-10 outline-hidden data-loading:animate-pulse"
        >
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  <Icon icon="triangle-exclamation" className="text-(--color-font-warning)" />
                  We found legacy Insomnia files in your repository
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="max-h-96 w-full overflow-x-hidden overflow-y-auto rounded-sm border border-solid border-(--hl-sm) select-none">
                  <Table
                    selectionMode="none"
                    aria-label="Insomnia files"
                    className="w-full table-fixed border-separate border-spacing-0"
                  >
                    <TableHeader>
                      <Column
                        isRowHeader
                        className="sticky top-0 z-10 border-b border-(--hl-sm) bg-(--hl-xs) px-2 py-2 text-left text-xs font-semibold backdrop-blur-sm backdrop-filter focus:outline-hidden"
                      >
                        Name
                      </Column>
                      <Column className="sticky top-0 z-10 border-b border-(--hl-sm) bg-(--hl-xs) px-2 py-2 text-left text-xs font-semibold backdrop-blur-sm backdrop-filter focus:outline-hidden">
                        Type
                      </Column>
                      <Column className="sticky top-0 z-10 border-b border-(--hl-sm) bg-(--hl-xs) px-2 py-2 text-left text-xs font-semibold backdrop-blur-sm backdrop-filter focus:outline-hidden">
                        File path
                      </Column>
                    </TableHeader>
                    <TableBody
                      className="divide divide-solid divide-(--hl-sm)"
                      items={[{ id: legacyFile.path, ...legacyFile }]}
                    >
                      {file => (
                        <Row className="group transition-colors focus-within:bg-(--hl-xxs) focus:outline-hidden">
                          <Cell className="border-b border-solid border-(--hl-sm) text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden">
                            <div className="flex items-center gap-2 px-2 py-2">
                              <span
                                className={`${scopeToBgColorMap[file.scope]} ${scopeToTextColorMap[file.scope]} flex aspect-square h-6 items-center justify-center rounded-sm`}
                              >
                                <Icon icon={scopeToIconMap[file.scope]} className="w-4" />
                              </span>
                              <span className="truncate">{file.name}</span>
                              {legacyFile.path === '.insomnia' && (
                                <span className="flex items-center gap-2 text-(--color-warning)">
                                  <Icon icon="triangle-exclamation" />
                                </span>
                              )}
                            </div>
                          </Cell>
                          <Cell className="border-b border-solid border-(--hl-sm) text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden">
                            <span className="flex items-center gap-1 px-2 text-(--hl)">
                              {scopeToLabelMap[legacyFile.scope]}
                            </span>
                          </Cell>
                          <Cell className="border-b border-solid border-(--hl-sm) text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden">
                            <span className="flex items-center gap-1 text-(--hl) italic">
                              <Icon
                                icon={legacyFile.path === '.insomnia' ? 'folder' : 'file'}
                                className="text-(--hl)"
                              />
                              <span className="truncate px-2 text-(--hl)">{legacyFile.path}</span>
                            </span>
                          </Cell>
                        </Row>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="rounded-xs bg-(--color-warning)/50 p-(--padding-sm) text-(--color-font-warning)">
                  <p className="pt-2">
                    This Git repository contains legacy Insomnia git files. These will be imported and migrated to the
                    new format supported in Insomnia 11+.
                  </p>
                  <p className="pt-2">
                    By migrating these <strong>a new commit will be created</strong> which once synced will result in
                    any users on older versions of Insomnia no longer being able to access these collections.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pb-10">
                <Button
                  isDisabled={migrateLegacyWorkspaceFetcher.state !== 'idle'}
                  onPress={migrateLegacyWorkspace}
                  className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                >
                  Migrate
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
