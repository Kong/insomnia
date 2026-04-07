import type { IconProp } from '@fortawesome/fontawesome-svg-core';

import type { Workspace, WorkspaceScope } from '~/insomnia-data';
import { models } from '~/insomnia-data';

import { strings } from './strings';

export type ProjectScopeKeys = WorkspaceScope | 'unsynced';

export const scopeToLabelMap: Record<
  ProjectScopeKeys,
  'Document' | 'Collection' | 'Mock Server' | 'Unsynced' | 'Environment' | 'MCP Client'
> = {
  'design': 'Document',
  'collection': 'Collection',
  'mock-server': 'Mock Server',
  'unsynced': 'Unsynced',
  'environment': 'Environment',
  'mcp': 'MCP Client',
};

export const scopeToIconMap: Record<ProjectScopeKeys, IconProp> = {
  'design': 'file',
  'collection': 'bars',
  'mock-server': 'server',
  'unsynced': 'cloud-download',
  'environment': 'code',
  'mcp': ['fac', 'mcp'] as unknown as IconProp,
};

export const scopeToBgColorMap: Record<ProjectScopeKeys, string> = {
  'design': 'bg-(--color-info)',
  'collection': 'bg-(--color-surprise)',
  'mock-server': 'bg-(--color-warning)',
  'unsynced': 'bg-(--hl-md)',
  'environment': 'bg-(--color-font)',
  'mcp': 'bg-(--color-danger)',
};

export const scopeToTextColorMap: Record<ProjectScopeKeys, string> = {
  'design': 'text-(--color-font-info)',
  'collection': 'text-(--color-font-surprise)',
  'mock-server': 'text-(--color-font-warning)',
  'unsynced': 'text-(--color-font)',
  'environment': 'text-(--color-bg)',
  'mcp': 'text-(--color-font-danger)',
};

export const getWorkspaceLabel = (workspace: Workspace) => {
  if (models.workspace.isDesign(workspace)) {
    return strings.document;
  }

  if (models.workspace.isMockServer(workspace)) {
    return strings.mock;
  }

  if (models.workspace.isEnvironment(workspace)) {
    return strings.environment;
  }

  if (models.workspace.isMcp(workspace)) {
    return strings.mcp;
  }

  return strings.collection;
};
