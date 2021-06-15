export interface StringInfo {
  singular: string;
  plural: string;
}

type StringId =
  | 'collection'
  | 'document'
  | 'home'
  | 'space'
  | 'workspace'
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
  home: {
    singular: 'Dashboard',
    plural: 'Dashboards',
  },
  space: {
    singular: 'Space',
    plural: 'Spaces',
  },
  workspace: {
    singular: 'Workspace',
    plural: 'Workspaces',
  },
};
