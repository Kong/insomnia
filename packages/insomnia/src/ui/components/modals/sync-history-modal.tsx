import React from 'react';
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
import { useFetcher, useParams } from 'react-router-dom';

import type { Snapshot } from '../../../sync/types';
import { useRootLoaderData } from '../../routes/root';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';
import { TimeFromNow } from '../time-from-now';

interface Props {
  history: Snapshot[];
  onClose: () => void;
}

const RestoreButton = ({ snapshot }: { snapshot: Snapshot }) => {
  const { projectId, workspaceId, organizationId } = useParams() as {
    projectId: string;
    workspaceId: string;
    organizationId: string;
  };

  const restoreChangesFetcher = useFetcher();

  return (
    <PromptButton
      className="flex min-w-[12ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
      confirmMessage="Confirm"
      onClick={() => {
        restoreChangesFetcher.submit(
          {
            id: snapshot.id,
          },
          {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/restore`,
          },
        );
      }}
    >
      Restore
    </PromptButton>
  );
};

export const SyncHistoryModal = ({ history, onClose }: Props) => {
  const { userSession } = useRootLoaderData();
  const authorName = (snapshot: Snapshot) => {
    let fullName = '';
    if (snapshot.authorAccount) {
      const { firstName, lastName } = snapshot.authorAccount;
      fullName += `${firstName} ${lastName}`;
    }
    if (snapshot.author === userSession.accountId) {
      fullName += ' (you)';
    }

    return fullName;
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
        className="flex max-h-full w-full max-w-4xl flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading className="text-2xl">History</Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="max-h-96 w-full select-none overflow-y-auto rounded border border-solid border-[--hl-sm]">
                <Table
                  selectionMode="multiple"
                  defaultSelectedKeys="all"
                  aria-label="Modified objects"
                  className="w-full border-separate border-spacing-0"
                >
                  <TableHeader>
                    <Column
                      isRowHeader
                      className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none"
                    >
                      Message
                    </Column>
                    <Column className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      When
                    </Column>
                    <Column className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      Author
                    </Column>
                    <Column className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      Objects
                    </Column>
                    <Column className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      Restore
                    </Column>
                  </TableHeader>
                  <TableBody className="divide divide-solid divide-[--hl-sm]" items={history}>
                    {item => (
                      <Row className="group transition-colors focus-within:bg-[--hl-xxs] focus:outline-none">
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <span className="p-2">{item.name}</span>
                        </Cell>
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <TimeFromNow className="no-wrap p-2" timestamp={item.created} intervalSeconds={30} />
                        </Cell>
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <div className="p-2">
                            {authorName(item) ? (
                              <>
                                {authorName(item)}{' '}
                                <HelpTooltip
                                  info
                                  // @ts-expect-error -- TSCONVERSION
                                  delay={500}
                                >
                                  {item.authorAccount?.email || ''}
                                </HelpTooltip>
                              </>
                            ) : (
                              '--'
                            )}
                          </div>
                        </Cell>
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <span className="p-2">{item.state.length}</span>
                        </Cell>
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <div className="p-2">
                            <RestoreButton snapshot={item} />
                          </div>
                        </Cell>
                      </Row>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
