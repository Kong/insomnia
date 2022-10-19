import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import { isRequestGroup, RequestGroup } from '../../../models/request-group';
import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
import { exportRequestsToFile } from '../../redux/modules/global';
import { selectSidebarChildren } from '../../redux/sidebar-selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { Tree } from '../export-requests/tree';

export interface Node {
  doc: Request | WebSocketRequest | GrpcRequest | RequestGroup;
  children: Node[];
  collapsed: boolean;
  totalRequests: number;
  selectedRequests: number;
}

export interface State {
  treeRoot: Node | null;
}
export interface ExportRequestsModalHandle {
  show: () => void;
  hide: () => void;
}
export const ExportRequestsModal = forwardRef<ExportRequestsModalHandle, ModalProps>((props, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({ treeRoot: null });
  const sidebarChildren = useSelector(selectSidebarChildren);
  const createNode = useCallback((item: Record<string, any>): Node => {
    const children: Node[] = item.children.map((child: Record<string, any>) => createNode(child));
    let totalRequests = children
      .map(child => child.totalRequests)
      .reduce((acc, totalRequests) => acc + totalRequests, 0);
    const docIsRequest = isRequest(item.doc) || isWebSocketRequest(item.doc) || isGrpcRequest(item.doc);
    if (docIsRequest) {
      totalRequests++;
    }
    return {
      doc: item.doc,
      collapsed: false,
      children: children,
      totalRequests: totalRequests,
      selectedRequests: totalRequests, // Default select all
    };
  }, []);
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: () => {
      modalRef.current?.show();
      const childObjects = sidebarChildren.all;
      const children: Node[] = childObjects.map(child => createNode(child));
      const totalRequests = children
        .map(child => child.totalRequests)
        .reduce((acc, totalRequests) => acc + totalRequests, 0);

      // @ts-expect-error -- TSCONVERSION missing property
      const rootFolder: RequestGroup = {
        ...models.requestGroup.init(),
        _id: 'all',
        type: models.requestGroup.type,
        name: 'All requests',
        parentId: '',
        modified: 0,
        created: 0,
      };
      setState({
        treeRoot: {
          doc: rootFolder,
          collapsed: false,
          children: children,
          totalRequests: totalRequests,
          selectedRequests: totalRequests, // Default select all
        },
      });
    },
  }), [createNode, sidebarChildren.all]);
  const getSelectedRequestIds = (node: Node): string[] => {
    const docIsRequest = isRequest(node.doc) || isWebSocketRequest(node.doc) || isGrpcRequest(node.doc);
    if (docIsRequest && node.selectedRequests === node.totalRequests) {
      return [node.doc._id];
    }
    const requestIds: string[] = [];
    for (const child of node.children) {
      const reqIds = getSelectedRequestIds(child);
      requestIds.push(...reqIds);
    }
    return requestIds;
  };

  const setItemSelected = (node: Node, isSelected: boolean, id?: string) => {
    if (id == null || node.doc._id === id) {
      // Switch the flags of all children in this subtree.
      for (const child of node.children) {
        setItemSelected(child, isSelected);
      }
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
  const handleSetItemSelected = (itemId: string, isSelected: boolean) => {
    const { treeRoot } = state;
    if (treeRoot == null) {
      return;
    }
    const found = setItemSelected(treeRoot, isSelected, itemId);
    if (!found) {
      return;
    }
    setState({ treeRoot: { ...treeRoot } });
  };
  const handleSetRequestGroupCollapsed = (requestGroupId: string, isCollapsed: boolean) => {
    const { treeRoot } = state;
    if (treeRoot == null) {
      return;
    }
    const found = setRequestGroupCollapsed(treeRoot, isCollapsed, requestGroupId);
    if (!found) {
      return;
    }
    setState({ treeRoot: { ...treeRoot } });
  };
  const setRequestGroupCollapsed = (node: Node, isCollapsed: boolean, requestGroupId: string) => {
    if (!isRequestGroup(node.doc)) {
      return false;
    }
    if (node.doc._id === requestGroupId) {
      node.collapsed = isCollapsed;
      return true;
    }
    for (const child of node.children) {
      const found = setRequestGroupCollapsed(child, isCollapsed, requestGroupId);
      if (found) {
        return true;
      }
    }
    return false;
  };
  const handleExport = () => {
    const { treeRoot } = state;
    if (treeRoot == null || treeRoot.selectedRequests === 0) {
      return;
    }
    const exportedRequestIds = getSelectedRequestIds(treeRoot);

    exportRequestsToFile(exportedRequestIds);
    modalRef.current?.hide();
  };

  const { treeRoot } = state;
  const isExportDisabled = treeRoot != null ? treeRoot.selectedRequests === 0 : false;
  return (
    <Modal ref={modalRef} tall {...props}>
      <ModalHeader>Select Requests to Export</ModalHeader>
      <ModalBody>
        <div className="requests-tree">
          <Tree
            root={treeRoot}
            handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
            handleSetItemSelected={handleSetItemSelected}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <div>
          <button className="btn" onClick={() => modalRef.current?.hide()}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={handleExport}
            disabled={isExportDisabled}
          >
            Export
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
});
ExportRequestsModal.displayName = 'ExportRequestsModal';
