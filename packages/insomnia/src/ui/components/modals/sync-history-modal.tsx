import React from 'react';
import { Button, Cell, Column, Dialog, Heading, Modal, ModalOverlay, Row, Table, TableBody, TableHeader } from 'react-aria-components';
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
      className="px-4 min-w-[12ch] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
      confirmMessage='Confirm'
      onClick={() => {
        restoreChangesFetcher.submit({
          id: snapshot.id,
        }, {
          method: 'POST',
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/restore`,
        });
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
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col max-w-4xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading className='text-2xl'>History</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='rounded w-full border border-solid border-[--hl-sm] select-none overflow-y-auto max-h-96'>
                <Table
                  selectionMode='multiple'
                  defaultSelectedKeys="all"
                  aria-label='Modified objects'
                  className="border-separate border-spacing-0 w-full"
                >
                  <TableHeader>
                    <Column isRowHeader className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      Message
                    </Column>
                    <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      When
                    </Column>
                    <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      Author
                    </Column>
                    <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      Objects
                    </Column>
                    <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      Restore
                    </Column>
                  </TableHeader>
                  <TableBody
                    className="divide divide-[--hl-sm] divide-solid"
                    items={history}
                  >
                    {item => (
                      <Row className="group focus:outline-none focus-within:bg-[--hl-xxs] transition-colors">
                        <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                          <span className='p-2'>
                            {item.name}
                          </span>
                        </Cell>
                        <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                          <TimeFromNow
                            className="no-wrap p-2"
                            timestamp={item.created}
                            intervalSeconds={30}
                          />
                        </Cell>
                        <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                          <div className='p-2' >
                            {Boolean(authorName(item)) ? (
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
                            ) : '--'}
                          </div>
                        </Cell>
                        <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                          <span className='p-2'>
                            {item.state.length}
                          </span>
                        </Cell>
                        <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                          <div className='p-2'>
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
