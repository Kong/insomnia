import React, { type FC, useEffect } from 'react';
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
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useFetcher, useParams } from 'react-router';

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
                  </TableHeader>
                  <TableBody
                    renderEmptyState={() => (
                      <div className="p-2 text-center">{isLoading ? 'Loading...' : 'No history available'}</div>
                    )}
                    className="divide divide-solid divide-[--hl-sm]"
                    items={log.filter(l => !!l).map(logEntry => ({ id: logEntry.oid, ...logEntry }))}
                  >
                    {item => (
                      <Row className="group transition-colors focus-within:bg-[--hl-xxs] focus:outline-none">
                        <Cell className="whitespace-nowrap text-wrap border-b border-solid border-[--hl-sm] p-2 text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <span>{item.commit.message}</span>
                        </Cell>
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <TimeFromNow
                            className="no-wrap p-2"
                            timestamp={item.commit.author.timestamp * 1000}
                            intervalSeconds={30}
                          />
                        </Cell>
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <TooltipTrigger>
                            <Button className="h-full p-2">{item.commit.author.name}</Button>
                            <Tooltip
                              placement="top end"
                              offset={8}
                              className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
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
