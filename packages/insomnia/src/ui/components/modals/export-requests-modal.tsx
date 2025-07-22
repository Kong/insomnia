import { exportRequestsToFile } from 'insomnia/src/ui/components/settings/import-export';
import React, { type FC, type ReactNode, useEffect, useState } from 'react';
import { Button, Checkbox, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router';

import { requestGroup } from '../../../models';
import { type GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, type Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import { isSocketIORequest, type SocketIORequest } from '../../../models/socket-io-request';
import { isWebSocketRequest, type WebSocketRequest } from '../../../models/websocket-request';
import { SegmentEvent } from '../../analytics';
import type { Child, WorkspaceLoaderData } from '../../routes/workspace';
import { Icon } from '../icon';
import { getMethodShortHand } from '../tags/method-tag';

export interface Node {
  doc: Request | WebSocketRequest | GrpcRequest | RequestGroup | SocketIORequest;
  children: Node[];
  collapsed: boolean;
  totalRequests: number;
  selectedRequests: number;
}

export const RequestGroupRow: FC<{
  children?: ReactNode;
  handleSetItemSelected: (...args: any[]) => any;
  handleSetRequestGroupCollapsed: (...args: any[]) => any;
  isCollapsed: boolean;
  requestGroup: RequestGroup;
  selectedRequests: number;
  totalRequests: number;
}> = ({
  children,
  handleSetItemSelected,
  handleSetRequestGroupCollapsed,
  isCollapsed,
  requestGroup,
  selectedRequests,
  totalRequests,
}) => {
  const isSelected = selectedRequests === totalRequests;
  const isIndeterminate = selectedRequests > 0 && selectedRequests < totalRequests;

  return (
    <li key={requestGroup._id} className="flex flex-col">
      <div className="flex items-center gap-2 p-2">
        <Checkbox
          aria-label={requestGroup.name}
          isIndeterminate={isIndeterminate}
          slot={null}
          isSelected={isSelected}
          onChange={isSelected => handleSetItemSelected(requestGroup._id, isSelected)}
          className="group flex h-full items-center p-0"
        >
          <div className="flex h-4 w-4 items-center justify-center rounded ring-1 ring-[--hl-sm] transition-colors group-focus:ring-2 group-data-[selected]:bg-[--hl-xs]">
            <Icon
              icon={isIndeterminate ? 'minus' : 'check'}
              className="h-3 w-3 opacity-0 group-data-[selected]:text-[--color-success] group-data-[indeterminate]:opacity-100 group-data-[selected]:opacity-100"
            />
          </div>
        </Checkbox>
        <Button
          className="flex items-center gap-2"
          onPress={() => handleSetRequestGroupCollapsed(requestGroup._id, !isCollapsed)}
        >
          <Icon icon={isCollapsed ? 'folder' : 'folder-open'} />
          {requestGroup.name}
          <span className="text-sm text-[--hl]">{totalRequests} requests</span>
        </Button>
      </div>

      <ul className="flex flex-col pl-5">{!isCollapsed ? children : null}</ul>
    </li>
  );
};

export const RequestRow: FC<{
  handleSetItemSelected: (...args: any[]) => any;
  isSelected: boolean;
  request: Request | WebSocketRequest | GrpcRequest | SocketIORequest;
}> = ({ handleSetItemSelected, request, isSelected }) => {
  return (
    <li className="flex items-center gap-2 p-2">
      <Checkbox
        slot={null}
        aria-label={request.name}
        isSelected={isSelected}
        onChange={isSelected => {
          handleSetItemSelected(request._id, isSelected);
        }}
        className="group flex h-full items-center p-0"
      >
        <div className="flex h-4 w-4 items-center justify-center rounded ring-1 ring-[--hl-sm] transition-colors group-focus:ring-2 group-data-[selected]:bg-[--hl-xs]">
          <Icon
            icon="check"
            className="h-3 w-3 opacity-0 group-data-[selected]:text-[--color-success] group-data-[selected]:opacity-100"
          />
        </div>
      </Checkbox>
      <div className="flex w-full items-center gap-2">
        {isRequest(request) && (
          <span
            className={`flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] text-[0.65rem] ${
              {
                GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-[--color-font-surprise]',
                POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-[--color-font-success]',
                HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-[--color-font-danger]',
                PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-[--color-font-warning]',
                PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-[--color-font-notice]',
              }[request.method] || 'bg-[--hl-md] text-[--color-font]'
            }`}
          >
            {getMethodShortHand(request)}
          </span>
        )}
        {isWebSocketRequest(request) && (
          <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-[--color-font-notice]">
            WS
          </span>
        )}
        {isGrpcRequest(request) && (
          <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-[--color-font-info]">
            gRPC
          </span>
        )}
        <span>{request.name}</span>
      </div>
    </li>
  );
};

export const Tree: FC<{
  root?: Node | null;
  handleSetRequestGroupCollapsed: (...args: any[]) => any;
  handleSetItemSelected: (...args: any[]) => any;
}> = ({ root, handleSetRequestGroupCollapsed, handleSetItemSelected }) => {
  const renderChildren = (node?: Node | null) => {
    if (node == null) {
      return null;
    }

    if (isRequest(node.doc) || isWebSocketRequest(node.doc) || isGrpcRequest(node.doc) || isSocketIORequest(node.doc)) {
      return (
        <RequestRow
          key={node.doc._id}
          handleSetItemSelected={handleSetItemSelected}
          isSelected={node.selectedRequests === node.totalRequests}
          request={node.doc}
        />
      );
    }

    if (node.totalRequests === 0) {
      // Don't show empty folders.
      return null;
    }

    return (
      <RequestGroupRow
        key={node.doc._id}
        handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
        handleSetItemSelected={handleSetItemSelected}
        isCollapsed={node.collapsed}
        totalRequests={node.totalRequests}
        selectedRequests={node.selectedRequests}
        requestGroup={node.doc}
      >
        {node.children.map(child => renderChildren(child))}
      </RequestGroupRow>
    );
  };

  return <ul className="flex flex-col">{renderChildren(root)}</ul>;
};

export const ExportRequestsModal = ({
  workspaceIdToExport,
  onClose,
}: {
  workspaceIdToExport: string;
  onClose: () => void;
}) => {
  const { organizationId, projectId } = useParams() as { organizationId: string; projectId: string };
  const workspaceFetcher = useFetcher();
  const [state, setState] = useState<{
    treeRoot: Node | null;
  }>();

  useEffect(() => {
    const isIdleAndUninitialized = workspaceFetcher.state === 'idle' && !workspaceFetcher.data;
    if (isIdleAndUninitialized) {
      workspaceFetcher.load(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceIdToExport}`);
    }
  }, [organizationId, projectId, workspaceFetcher, workspaceIdToExport]);
  const workspaceLoaderData = workspaceFetcher?.data as WorkspaceLoaderData;

  useEffect(() => {
    const createTreeNode = (child: Child): Node => {
      const docIsRequest = isRequest(child.doc) || isWebSocketRequest(child.doc) || isGrpcRequest(child.doc);
      const children = child.children.map((child: Child) => createTreeNode(child));
      const totalRequests = +docIsRequest + children.reduce((acc, { totalRequests }) => acc + totalRequests, 0);
      return {
        doc: child.doc,
        collapsed: false,
        children,
        totalRequests: totalRequests,
        selectedRequests: totalRequests, // Default select all
      };
    };
    const requestTree = workspaceLoaderData?.requestTree || [];
    const children: Node[] = requestTree.map(child => createTreeNode(child));
    setState({
      treeRoot: {
        doc: {
          ...requestGroup.init(),
          _id: 'all',
          type: requestGroup.type,
          name: 'All requests',
          parentId: '',
          modified: 0,
          created: 0,
          isPrivate: false,
        },
        collapsed: false,
        children: children,
        totalRequests: children
          .map(child => child.totalRequests)
          .reduce((acc, totalRequests) => acc + totalRequests, 0),
        selectedRequests: children
          .map(child => child.totalRequests)
          .reduce((acc, totalRequests) => acc + totalRequests, 0), // Default select all
      },
    });
  }, [workspaceLoaderData?.requestTree]);

  if (!workspaceLoaderData) {
    return null;
  }

  const getSelectedRequestIds = (node: Node): string[] => {
    const docIsRequest = isRequest(node.doc) || isWebSocketRequest(node.doc) || isGrpcRequest(node.doc);
    if (docIsRequest && node.selectedRequests === node.totalRequests) {
      return [node.doc._id];
    }
    return node.children.flatMap(child => getSelectedRequestIds(child));
  };

  const setItemSelected = (node: Node, isSelected: boolean, id?: string) => {
    if (id == null || node.doc._id === id) {
      // Switch the flags of all children in this subtree.
      node.children.forEach(child => setItemSelected(child, isSelected));
      node.selectedRequests = isSelected ? node.totalRequests : 0;
      return true;
    }
    for (const child of node.children) {
      const found = setItemSelected(child, isSelected, id);
      if (found) {
        node.selectedRequests = node.children
          .map(ch => ch.selectedRequests)
          .reduce((acc, selected) => acc + selected, 0);
        return true;
      }
    }
    return false;
  };

  const setRequestGroupCollapsed = (node: Node, isCollapsed: boolean, requestGroupId: string): boolean => {
    if (node.doc._id === requestGroupId) {
      node.collapsed = isCollapsed;
      return true;
    }
    return !!node.children.find(child => setRequestGroupCollapsed(child, isCollapsed, requestGroupId));
  };

  const isExportDisabled =
    (state?.treeRoot?.totalRequests && state?.treeRoot?.totalRequests > 0 && state?.treeRoot?.selectedRequests === 0) ||
    false;

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
                <Heading slot="title" className="text-2xl">
                  Export requests
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="max-h-96 min-h-[20rem] w-full select-none overflow-y-auto rounded border border-solid border-[--hl-sm]">
                <Tree
                  root={state?.treeRoot}
                  handleSetRequestGroupCollapsed={(requestGroupId: string, isCollapsed: boolean) => {
                    if (state?.treeRoot && setRequestGroupCollapsed(state?.treeRoot, isCollapsed, requestGroupId)) {
                      setState({ treeRoot: state?.treeRoot });
                    }
                  }}
                  handleSetItemSelected={(itemId: string, isSelected: boolean) => {
                    if (state?.treeRoot && setItemSelected(state?.treeRoot, isSelected, itemId)) {
                      setState({ treeRoot: state?.treeRoot });
                    }
                  }}
                />
              </div>
              <div className="flex flex-1 flex-shrink-0 items-center justify-end gap-2">
                <Button
                  onPress={close}
                  className="flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--color-font] transition-colors hover:bg-opacity-90 hover:no-underline"
                >
                  Cancel
                </Button>
                <Button
                  onPress={() => {
                    if (state?.treeRoot) {
                      window.main.trackSegmentEvent({
                        event: SegmentEvent.exportRequestsChosen,
                        properties: {
                          totalRequests: state.treeRoot.totalRequests,
                          exported_requests: state.treeRoot.selectedRequests,
                        },
                      });
                    }
                    state?.treeRoot && exportRequestsToFile(workspaceIdToExport, getSelectedRequestIds(state.treeRoot));
                    close();
                  }}
                  isDisabled={isExportDisabled}
                  className="flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline"
                >
                  <Icon icon="save" /> Export
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
