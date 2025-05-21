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
import { useFetcher, useParams } from 'react-router';

import type { WorkspaceScope } from '../../../models/workspace';
import { scopeToBgColorMap, scopeToIconMap, scopeToLabelMap, scopeToTextColorMap } from '../../routes/project';
import { Icon } from '../icon';

export const GitProjectMigrationModal: FC<{
  onClose: () => void;
  legacyFile: { name: string; scope: WorkspaceScope; path: string };
}> = ({ onClose, legacyFile }) => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const migrateLegacyWorkspaceFetcher = useFetcher();

  const migrateLegacyWorkspace = () => {
    migrateLegacyWorkspaceFetcher.submit(
      {},
      {
        method: 'POST',
        action: `/organization/${organizationId}/project/${projectId}/git/migrate-legacy-insomnia-folder-to-file`,
        encType: 'application/json',
      },
    );
  };

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex max-h-[90dvh] min-h-[420px] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          data-loading={migrateLegacyWorkspaceFetcher.state === 'loading' ? 'true' : undefined}
          className="flex h-full flex-1 flex-col overflow-hidden px-10 pt-10 outline-none data-[loading]:animate-pulse"
        >
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  <Icon icon="triangle-exclamation" className="text-[--color-font-warning]" />
                  We found legacy Insomnia files in your repository
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="max-h-96 w-full select-none overflow-y-auto overflow-x-hidden rounded border border-solid border-[--hl-sm]">
                  <Table
                    selectionMode="none"
                    aria-label="Insomnia files"
                    className="w-full table-fixed border-separate border-spacing-0"
                  >
                    <TableHeader>
                      <Column
                        isRowHeader
                        className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none"
                      >
                        Name
                      </Column>
                      <Column className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                        Type
                      </Column>
                      <Column className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                        File path
                      </Column>
                    </TableHeader>
                    <TableBody
                      className="divide divide-solid divide-[--hl-sm]"
                      items={[{ id: legacyFile.path, ...legacyFile }]}
                    >
                      {file => (
                        <Row className="group transition-colors focus-within:bg-[--hl-xxs] focus:outline-none">
                          <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                            <div className="flex items-center gap-2 px-2 py-2">
                              <span
                                className={`${scopeToBgColorMap[file.scope]} ${scopeToTextColorMap[file.scope]} flex aspect-square h-6 items-center justify-center rounded`}
                              >
                                <Icon icon={scopeToIconMap[file.scope]} className="w-4" />
                              </span>
                              <span className="truncate">{file.name}</span>
                              {legacyFile.path === '.insomnia' && (
                                <span className="flex items-center gap-2 text-[--color-warning]">
                                  <Icon icon="triangle-exclamation" />
                                </span>
                              )}
                            </div>
                          </Cell>
                          <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                            <span className="flex items-center gap-1 px-2 text-[--hl]">
                              {scopeToLabelMap[legacyFile.scope]}
                            </span>
                          </Cell>
                          <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                            <span className="flex items-center gap-1 italic text-[--hl]">
                              <Icon
                                icon={legacyFile.path === '.insomnia' ? 'folder' : 'file'}
                                className="text-[--hl]"
                              />
                              <span className="truncate px-2 text-[--hl]">{legacyFile.path}</span>
                            </span>
                          </Cell>
                        </Row>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="rounded-sm bg-[rgba(var(--color-warning-rgb),var(--tw-bg-opacity))] bg-opacity-50 p-[--padding-sm] text-[--color-font-warning]">
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
                  onPress={migrateLegacyWorkspace}
                  className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-4 py-2 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80"
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
