import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import type { WorkspaceScope } from 'insomnia-data';

import type { CreateRequestType } from '~/ui/hooks/use-request';

export interface ActionItem {
  id: string;
  name: string;
  icon: IconProp;
  action: () => void;
  scope?: WorkspaceScope;
}

export const createWorkspaceActionItems = ({
  createCollection,
  createMcpClient,
  createMockServer,
  createEnvironment,
  canCreateMockServer,
}: {
  createCollection: () => void;
  createMcpClient: () => void;
  createMockServer: () => void;
  createEnvironment: () => void;
  canCreateMockServer: boolean;
}): ActionItem[] => {
  return [
    {
      id: 'new-collection',
      name: 'API Collection',
      scope: 'collection',
      icon: 'bars',
      action: createCollection,
    },
    {
      id: 'new-mcp-client',
      name: 'MCP Client',
      scope: 'mcp',
      icon: ['fac', 'mcp'] as unknown as IconProp,
      action: createMcpClient,
    },
    ...(canCreateMockServer
      ? [
          {
            id: 'new-mock-server',
            name: 'Mock Server',
            scope: 'mock-server' as WorkspaceScope,
            icon: 'server' as IconName,
            action: createMockServer,
          },
        ]
      : []),
    {
      id: 'new-environment',
      name: 'Environment',
      scope: 'environment',
      icon: 'code',
      action: createEnvironment,
    },
  ];
};

export const createRequestOrFolderActionItems = ({
  createRequest,
  createFolder,
  folderFirst = false,
}: {
  createRequest: (requestType: CreateRequestType) => void;
  createFolder: () => void;
  folderFirst?: boolean;
}): ActionItem[] => {
  const folderItem: ActionItem = {
    id: 'New Folder',
    name: 'New Folder',
    icon: 'folder',
    action: createFolder,
  };

  const requestItems: ActionItem[] = [
    {
      id: 'HTTP',
      name: 'HTTP Request',
      icon: 'plus-circle',
      action: () => createRequest('HTTP'),
    },
    {
      id: 'Event Stream',
      name: 'Event Stream Request (SSE)',
      icon: 'plus-circle',
      action: () => createRequest('Event Stream'),
    },
    {
      id: 'GraphQL Request',
      name: 'GraphQL Request',
      icon: 'plus-circle',
      action: () => createRequest('GraphQL'),
    },
    {
      id: 'gRPC Request',
      name: 'gRPC Request',
      icon: 'plus-circle',
      action: () => createRequest('gRPC'),
    },
    {
      id: 'WebSocket Request',
      name: 'WebSocket Request',
      icon: 'plus-circle',
      action: () => createRequest('WebSocket'),
    },
    {
      id: 'Socket.IO Request',
      name: 'Socket.IO Request',
      icon: 'plus-circle',
      action: () => createRequest('SocketIO'),
    },
  ];

  return folderFirst ? [folderItem, ...requestItems] : [...requestItems, folderItem];
};
