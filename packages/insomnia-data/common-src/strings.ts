export interface StringInfo {
  singular: string;
  plural: string;
}

type StringId =
  | 'collection'
  | 'mock'
  | 'document'
  | 'organization'
  | 'project'
  | 'workspace'
  | 'defaultProject'
  | 'localProject'
  | 'remoteProject'
  | 'environment'
  | 'mcp';

export const strings: Record<StringId, StringInfo> = {
  collection: {
    singular: 'Collection',
    plural: 'Collections',
  },
  mock: {
    singular: 'Mock',
    plural: 'Mocks',
  },
  document: {
    singular: 'Document',
    plural: 'Documents',
  },
  organization: {
    singular: 'Organization',
    plural: 'Organizations',
  },
  project: {
    singular: 'Project',
    plural: 'Projects',
  },
  workspace: {
    singular: 'Workspace',
    plural: 'Workspaces',
  },
  defaultProject: {
    singular: 'Default',
    plural: 'Default',
  },
  localProject: {
    singular: 'Local',
    plural: 'Local',
  },
  remoteProject: {
    singular: 'Remote',
    plural: 'Remote',
  },
  environment: {
    singular: 'Environment',
    plural: 'Environments',
  },
  mcp: {
    singular: 'MCP Client',
    plural: 'MCP Clients',
  },
};
