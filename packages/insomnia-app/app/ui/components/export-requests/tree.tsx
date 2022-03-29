import React, { PureComponent } from 'react';

import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import type { Node } from '../modals/export-requests-modal';
import { RequestGroupRow } from './request-group-row';
import { RequestRow } from './request-row';

interface Props {
  root?: Node | null;
  handleSetRequestGroupCollapsed: (...args: any[]) => any;
  handleSetItemSelected: (...args: any[]) => any;
}

export class Tree extends PureComponent<Props> {
  renderChildren(node?: Node | null) {
    if (node == null) {
      return null;
    }

    if (isRequest(node.doc) || isGrpcRequest(node.doc)) {
      // Directly casting will result in error, so cast it to any first.
      const request: Request | GrpcRequest = (node.doc as any) as Request | GrpcRequest;
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
    const requestGroup: RequestGroup = (node.doc as any) as RequestGroup;
    return (
      <RequestGroupRow
        key={node.doc._id}
        handleSetRequestGroupCollapsed={this.props.handleSetRequestGroupCollapsed}
        handleSetItemSelected={this.props.handleSetItemSelected}
        isCollapsed={node.collapsed}
        totalRequests={node.totalRequests}
        selectedRequests={node.selectedRequests}
        requestGroup={requestGroup}
      >
        {children}
      </RequestGroupRow>
    );
  }

  render() {
    const { root } = this.props;
    return (
      <ul className="tree__list tree__list-root theme--tree__list">{this.renderChildren(root)}</ul>
    );
  }
}
