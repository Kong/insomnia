import React, { FC } from 'react';

import { isGrpcRequest } from '../../../models/grpc-request';
import { isRequest } from '../../../models/request';
import { isWebSocketRequest } from '../../../models/websocket-request';
import type { Node } from '../modals/export-requests-modal';
import { RequestGroupRow } from './request-group-row';
import { RequestRow } from './request-row';

interface Props {
  root?: Node | null;
  handleSetRequestGroupCollapsed: (...args: any[]) => any;
  handleSetItemSelected: (...args: any[]) => any;
}

export const Tree: FC<Props> = ({ root, handleSetRequestGroupCollapsed, handleSetItemSelected }) => {
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
    <ul className="tree__list tree__list-root theme--tree__list">{renderChildren(root)}</ul>
  );
};
