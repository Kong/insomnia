import React, { type FC, type ReactNode, useEffect, useState } from 'react';
import { Button, Checkbox, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { exportRequestsToFile } from '../../../common/export';
import { requestGroup } from '../../../models';
import { type GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, type Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import { isWebSocketRequest, type WebSocketRequest } from '../../../models/websocket-request';
import type { Child, WorkspaceLoaderData } from '../../routes/workspace';
import { Icon } from '../icon';
import { getMethodShortHand } from '../tags/method-tag';

export interface Node {
  doc: Request | WebSocketRequest | GrpcRequest | RequestGroup;
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
          <Checkbox aria-label={requestGroup.name} isIndeterminate={isIndeterminate} slot={null} isSelected={isSelected} onChange={isSelected => handleSetItemSelected(requestGroup._id, isSelected)} className="group p-0 flex items-center h-full">
            <div className="w-4 h-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
              <Icon icon={isIndeterminate ? 'minus' : 'check'} className='opacity-0 group-data-[selected]:opacity-100 group-data-[indeterminate]:opacity-100 group-data-[selected]:text-[--color-success] w-3 h-3' />
            </div>
          </Checkbox>
          <Button className="flex items-center gap-2" onPress={() => handleSetRequestGroupCollapsed(requestGroup._id, !isCollapsed)}>
            <Icon icon={isCollapsed ? 'folder' : 'folder-open'} />
            {requestGroup.name}
            <span className="text-sm text-[--hl]">{totalRequests} requests</span>
          </Button>
        </div>

        <ul
          className="flex flex-col pl-5"
        >
          {!isCollapsed ? children : null}
        </ul>
      </li>
    );
  };

export const RequestRow: FC<{
  handleSetItemSelected: (...args: any[]) => any;
  isSelected: boolean;
  request: Request | WebSocketRequest | GrpcRequest;
}> = ({
  handleSetItemSelected,
  request,
  isSelected,
}) => {
    return (
      <li className="flex items-center gap-2 p-2">
        <Checkbox
          slot={null}
          aria-label={request.name}
          isSelected={isSelected}
          onChange={isSelected => {
            handleSetItemSelected(request._id, isSelected);
          }}
          className="group p-0 flex items-center h-full"
        >
          <div className="w-4 h-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
            <Icon icon='check' className='opacity-0 group-data-[selected]:opacity-100 group-data-[selected]:text-[--color-success] w-3 h-3' />
          </div>
        </Checkbox>
        <div className="w-full flex items-center gap-2">
          {isRequest(request) && (
            <span
              className={
                `w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center
                  ${{
                  'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
                  'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
                  'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                  'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                  'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
                  'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
                  'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
                }[request.method] || 'text-[--color-font] bg-[--hl-md]'}`
              }
            >
              {getMethodShortHand(request)}
            </span>
          )}
          {isWebSocketRequest(request) && (
            <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]">
              WS
            </span>
          )}
          {isGrpcRequest(request) && (
            <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]">
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

    if (isRequest(node.doc) || isWebSocketRequest(node.doc) || isGrpcRequest(node.doc)) {
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

  return (
    <ul className="flex flex-col">{renderChildren(root)}</ul>
  );
};

export const ExportRequestsModal = ({ workspaceIdToExport, onClose }: { workspaceIdToExport: string; onClose: () => void }) => {
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
        totalRequests: children.map(child => child.totalRequests).reduce((acc, totalRequests) => acc + totalRequests, 0),
        selectedRequests: children.map(child => child.totalRequests).reduce((acc, totalRequests) => acc + totalRequests, 0), // Default select all
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
    return node.children.map(child => getSelectedRequestIds(child)).reduce((acc, reqIds) => [...acc, ...reqIds], []);
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
        node.selectedRequests = node.children.map(ch => ch.selectedRequests).reduce((acc, selected) => acc + selected, 0);
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

  const isExportDisabled = (state?.treeRoot?.totalRequests && state?.treeRoot?.totalRequests > 0 && state?.treeRoot?.selectedRequests === 0) || false;

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
                <Heading slot="title" className='text-2xl'>Export requests</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='rounded w-full border border-solid border-[--hl-sm] select-none overflow-y-auto min-h-[20rem] max-h-96'>
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
              <div className="flex flex-shrink-0 flex-1 justify-end gap-2 items-center">
                <Button
                  onPress={close}
                  className="hover:no-underline flex items-center gap-2 hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                >
                  Cancel
                </Button>
                <Button
                  onPress={() => {
                    state?.treeRoot && exportRequestsToFile(workspaceIdToExport, getSelectedRequestIds(state.treeRoot));
                    close();
                  }}
                  isDisabled={isExportDisabled}
                  className="hover:no-underline flex items-center gap-2 bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
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
