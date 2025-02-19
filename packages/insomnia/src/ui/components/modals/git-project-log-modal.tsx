import React, { type FC, useEffect } from 'react';
import { Button, Cell, Column, Dialog, Heading, Modal, ModalOverlay, Row, Table, TableBody, TableHeader, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import type { GitLogLoaderData } from '../../routes/git-project-actions';
import { Icon } from '../icon';
import { TimeFromNow } from '../time-from-now';

interface Props {
  onClose: () => void;
}

export const GitProjectLogModal: FC<Props> = ({ onClose }) => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const gitLogFetcher = useFetcher<GitLogLoaderData>();

  const isLoading = gitLogFetcher.state !== 'idle';

  useEffect(() => {
    if (gitLogFetcher.state === 'idle' && !gitLogFetcher.data) {
      // file://./../../routes/git-actions.tsx#gitLogLoader
      gitLogFetcher.load(`/organization/${organizationId}/project/${projectId}/git/log`);
    }
  }, [organizationId, projectId, gitLogFetcher]);

  const { log } = gitLogFetcher.data && 'log' in gitLogFetcher.data ? gitLogFetcher.data : { log: [] };

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
                  </TableHeader>
                  <TableBody
                    renderEmptyState={() => (
                      <div className='p-2 text-center'>
                        {isLoading ? 'Loading...' : 'No history available'}
                      </div>
                    )}
                    className="divide divide-[--hl-sm] divide-solid"
                    items={log.map(logEntry => ({ id: logEntry.oid, ...logEntry }))}
                  >
                    {item => (
                      <Row className="group focus:outline-none focus-within:bg-[--hl-xxs] transition-colors">
                        <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                          <span className='p-2'>
                            {item.commit.message}
                          </span>
                        </Cell>
                        <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                          <TimeFromNow
                            className="no-wrap p-2"
                            timestamp={item.commit.author.timestamp * 1000}
                            intervalSeconds={30}
                          />
                        </Cell>
                        <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                          <TooltipTrigger>
                            <Button className="p-2 h-full">
                              {item.commit.author.name}
                            </Button>
                            <Tooltip
                              placement="top end"
                              offset={8}
                              className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                            >
                              {item.commit.author.email}
                            </Tooltip>
                          </TooltipTrigger>
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
