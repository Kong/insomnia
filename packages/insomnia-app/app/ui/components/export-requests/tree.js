// @flow
import * as React from 'react';
import RequestRow from './request-row';
import RequestGroupRow from './request-group-row';
import type { Node } from '../modals/export-requests-modal';
import type { Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import { isGrpcRequest, isRequest } from '../../../models/helpers/is-model';
import type { GrpcRequest } from '../../../models/grpc-request';

type Props = {
  root: ?Node,
  handleSetRequestGroupCollapsed: Function,
  handleSetItemSelected: Function,
};

class Tree extends React.PureComponent<Props> {
  renderChildren(node: ?Node) {
    if (node == null) {
      return null;
    }

    if (isRequest(node.doc) || isGrpcRequest(node.doc)) {
      // Directly casting will result in error, so cast it to any first.
      const request: Request | GrpcRequest = ((node.doc: any): Request | GrpcRequest);
      return (
        <RequestRow
          key={node.doc._id}
          handleSetItemSelected={this.props.handleSetItemSelected}
          isSelected={node.selectedRequests === node.totalRequests}
          request={request}
        />
      );
    }

    if (node.totalRequests === 0) {
      // Don't show empty folders.
      return null;
    }

    const children = node.children.map(child => this.renderChildren(child));

    // Directly cast to RequestGroup will result in error, so cast it to any first.
    const requestGroup: RequestGroup = ((node.doc: any): RequestGroup);
    return (
      <RequestGroupRow
        key={node.doc._id}
        handleSetRequestGroupCollapsed={this.props.handleSetRequestGroupCollapsed}
        handleSetItemSelected={this.props.handleSetItemSelected}
        isCollapsed={node.collapsed}
        totalRequests={node.totalRequests}
        selectedRequests={node.selectedRequests}
        requestGroup={requestGroup}
        children={children}
      />
    );
  }

  render() {
    const { root } = this.props;
    return (
      <ul className="tree__list tree__list-root theme--tree__list">{this.renderChildren(root)}</ul>
    );
  }
}

export default Tree;
