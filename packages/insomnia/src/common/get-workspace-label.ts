import { isDesign, isEnvironment, isMockServer, type Workspace } from 'insomnia-database/models/workspace';

const strings = {
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
};

export const getWorkspaceLabel = (workspace: Workspace) => {
  if (isDesign(workspace)) {
    return strings.document;
  }

  if (isMockServer(workspace)) {
    return strings.mock;
  }

  if (isEnvironment(workspace)) {
    return strings.environment;
  }

  return strings.collection;
};
