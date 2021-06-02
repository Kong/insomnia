export interface Label {
  singular: string;
  plural: string;
}
interface Strings {
  document: Label;
  collection: Label;
  space: Label;
  home: Label;
}

export const strings: Strings = {
  document: {
    singular: 'Document',
    plural: 'Documents',
  },
  collection: {
    singular: 'Collection',
    plural: 'Collections',
  },
  space: {
    singular: 'Space',
    plural: 'Spaces',
  },
  home: {
    singular: 'Dashboard',
    plural: 'Dashboards',
  },
};
