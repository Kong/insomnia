export interface StringInfo {
  singular: string;
  plural: string;
}

type StringId =
  | 'collection'
  | 'document'
  | 'project'
  | 'workspace'
  | 'defaultProject'
  | 'localProject'
  | 'remoteProject'
  ;

export const strings: Record<StringId, StringInfo> = {
  collection: {
    singular: 'Collection',
    plural: 'Collections',
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
};
