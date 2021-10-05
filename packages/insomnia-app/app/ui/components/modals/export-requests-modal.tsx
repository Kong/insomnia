import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import * as models from '../../../models';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import { isRequestGroup, RequestGroup } from '../../../models/request-group';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { Tree } from '../export-requests/tree';
import { Child } from '../sidebar/sidebar-children';

export interface Node {
  doc: Request | GrpcRequest | RequestGroup;
  children: Node[];
  collapsed: boolean;
  totalRequests: number;
  selectedRequests: number;
}

interface Props extends ModalProps {
  childObjects: Child[];
  handleExportRequestsToFile: Function;
}

interface State {
  treeRoot: Node | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ExportRequestsModal extends PureComponent<Props, State> {
  modal: Modal | null = null;

  state: State = {
    treeRoot: null,
  };

  setModalRef(modal: Modal) {
    if (modal != null) {
      this.modal = modal;
    }
  }

  show() {
    this.modal?.show();
    this.createTree();
  }

  hide() {
    this.modal?.hide();
  }

  handleExport() {
    const { treeRoot } = this.state;

    if (treeRoot == null || treeRoot.selectedRequests === 0) {
      return;
    }

    const exportedRequestIds = this.getSelectedRequestIds(treeRoot);
    this.props.handleExportRequestsToFile(exportedRequestIds);
    this.hide();
  }

  getSelectedRequestIds(node: Node): string[] {
    const docIsRequest = isRequest(node.doc) || isGrpcRequest(node.doc);

    if (docIsRequest && node.selectedRequests === node.totalRequests) {
      return [node.doc._id];
    }

    const requestIds: string[] = [];

    for (const child of node.children) {
      const reqIds = this.getSelectedRequestIds(child);
      requestIds.push(...reqIds);
    }

    return requestIds;
  }

  createTree() {
    const { childObjects } = this.props;
    const children: Node[] = childObjects.map(child => this.createNode(child));
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
    this.setState({
      treeRoot: {
        doc: rootFolder,
        collapsed: false,
        children: children,
        totalRequests: totalRequests,
        selectedRequests: totalRequests, // Default select all
      },
    });
  }

  createNode(item: Record<string, any>): Node {
    const children: Node[] = item.children.map(child => this.createNode(child));
    let totalRequests = children
      .map(child => child.totalRequests)
      .reduce((acc, totalRequests) => acc + totalRequests, 0);
    const docIsRequest = isRequest(item.doc) || isGrpcRequest(item.doc);

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
  }

  handleSetRequestGroupCollapsed(requestGroupId: string, isCollapsed: boolean) {
    const { treeRoot } = this.state;

    if (treeRoot == null) {
      return;
    }

    const found = this.setRequestGroupCollapsed(treeRoot, isCollapsed, requestGroupId);

    if (!found) {
      return;
    }

    this.setState({
      treeRoot: { ...treeRoot },
    });
  }

  handleSetItemSelected(itemId: string, isSelected: boolean) {
    const { treeRoot } = this.state;

    if (treeRoot == null) {
      return;
    }

    const found = this.setItemSelected(treeRoot, isSelected, itemId);

    if (!found) {
      return;
    }

    this.setState({
      treeRoot: { ...treeRoot },
    });
  }

  setRequestGroupCollapsed(node: Node, isCollapsed: boolean, requestGroupId: string) {
    if (!isRequestGroup(node.doc)) {
      return false;
    }

    if (node.doc._id === requestGroupId) {
      node.collapsed = isCollapsed;
      return true;
    }

    for (const child of node.children) {
      const found = this.setRequestGroupCollapsed(child, isCollapsed, requestGroupId);

      if (found) {
        return true;
      }
    }

    return false;
  }

  setItemSelected(node: Node, isSelected: boolean, id?: string) {
    if (id == null || node.doc._id === id) {
      // Switch the flags of all children in this subtree.
      for (const child of node.children) {
        this.setItemSelected(child, isSelected);
      }

      node.selectedRequests = isSelected ? node.totalRequests : 0;
      return true;
    }

    for (const child of node.children) {
      const found = this.setItemSelected(child, isSelected, id);

      if (found) {
        node.selectedRequests = node.children
          .map(ch => ch.selectedRequests)
          .reduce((acc, selected) => acc + selected, 0);
        return true;
      }
    }

    return false;
  }

  render() {
    const { treeRoot } = this.state;
    const isExportDisabled = treeRoot != null ? treeRoot.selectedRequests === 0 : false;
    return (
      <Modal ref={this.setModalRef} tall freshState {...this.props}>
        <ModalHeader>Select Requests to Export</ModalHeader>
        <ModalBody>
          <div className="requests-tree">
            <Tree
              root={treeRoot}
              handleSetRequestGroupCollapsed={this.handleSetRequestGroupCollapsed}
              handleSetItemSelected={this.handleSetItemSelected}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <div>
            <button className="btn" onClick={this.hide}>
              Cancel
            </button>
            <button className="btn" onClick={this.handleExport} disabled={isExportDisabled}>
              Export
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}
