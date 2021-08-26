import { DEFAULT_PROJECT_ID, Project, sortProjects } from '../project';

describe('sortProjects', () => {
  it('returns the correct sort order', () => {
    const unSortedProjects = [
      { type: 'remote', name: 'a', remoteId: 'notNull' },
      { type: 'local', name: 'b', remoteId: null },
      { type: 'default', name: 'a', remoteId: null, id: DEFAULT_PROJECT_ID },
      { type: 'remote', name: 'b', remoteId: 'notNull' },
      { type: 'local', name: 'a', remoteId: null },
      { type: 'remote', name: '0', remoteId: 'notNull' },
    ] as Project[];
    const result = sortProjects(unSortedProjects);

    const sortedProjects = [
      { type: 'default', name: 'a', remoteId: null, id: DEFAULT_PROJECT_ID },
      { type: 'local', name: 'a', remoteId: null },
      { type: 'local', name: 'b', remoteId: null },
      { type: 'remote', name: '0', remoteId: 'notNull' },
      { type: 'remote', name: 'a', remoteId: 'notNull' },
      { type: 'remote', name: 'b', remoteId: 'notNull' },
    ] as Project[];
    expect(result).toEqual(sortedProjects);
  });
});
