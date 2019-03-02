// @flow
import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import Tree from '../export-requests/tree';
import type { Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import * as models from '../../../models';

export type Node = {
  doc: Request | RequestGroup,
  children: Array<Node>,
  collapsed: boolean,
  totalRequests: number,
  selectedRequests: number,
};

type Props = {
  childObjects: Array<Object>,
};

type State = {
  treeRoot: ?Node,
};

@autobind
class ExportRequestsModal extends PureComponent<Props, State> {
  modal: Modal;

  constructor(props: Props) {
    super(props);
    this.state = {
      treeRoot: null,
    };
  }

  setModalRef(modal: ?Modal) {
    if (modal != null) {
      this.modal = modal;
    }
  }

  show() {
    this.modal.show();
    this.createNewTree();
  }

  hide() {
    this.modal.hide();
  }

  handleExport() {}

  createNewTree() {
    const { childObjects } = this.props;
    const children: Array<Node> = childObjects.map(child => this.createTree(child));
    const totalRequests = children
      .map(child => child.totalRequests)
      .reduce((acc, totalRequests) => acc + totalRequests, 0);
    const rootFolder: RequestGroup = Object.assign({}, models.requestGroup.init(), {
      _id: 'all',
      type: models.requestGroup.type,
      name: 'All requests',
      parentId: '',
      modified: 0,
      created: 0,
    });
    this.setState({
      treeRoot: {
        doc: rootFolder,
        collapsed: false,
        children: children,
        totalRequests: totalRequests,
        selectedRequests: 0,
      },
    });
  }

  createTree(item: Object): Node {
    const children: Array<Node> = item.children.map(child => this.createTree(child));
    let totalRequests = children
      .map(child => child.totalRequests)
      .reduce((acc, totalRequests) => acc + totalRequests, 0);
    if (item.doc.type === models.request.type) {
      totalRequests++;
    }
    return {
      doc: item.doc,
      collapsed: false,
      children: children,
      totalRequests: totalRequests,
      selectedRequests: 0,
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

  setRequestGroupCollapsed(node: Node, isCollapsed: boolean, requestGroupId: string): boolean {
    if (node.doc.type !== models.requestGroup.type) {
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

  setItemSelected(node: Node, isSelected: boolean, id?: string): boolean {
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
        <ModalHeader>Export Requests</ModalHeader>
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

export default ExportRequestsModal;
