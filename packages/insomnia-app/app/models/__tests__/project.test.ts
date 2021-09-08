import { DEFAULT_PROJECT_ID, Project, sortProjects } from '../project';

const defaultProject = { name: 'a', remoteId: null, id: DEFAULT_PROJECT_ID };

const localA = { name: 'a', remoteId: null };
const localB = { name: 'b', remoteId: null };

const remoteA = { name: 'a', remoteId: 'notNull' };
const remoteB = { name: 'b', remoteId: 'notNull' };
const remote0 = { name: '0', remoteId: 'notNull' };

describe('sortProjects', () => {
  it('sorts projects by default > local > remote > name', () => {
    const unSortedProjects = [
      remoteA,
      localB,
      defaultProject,
      remoteB,
      localA,
      remote0,
    ] as Project[];
    const result = sortProjects(unSortedProjects);

    const sortedProjects = [
      defaultProject,
      localA,
      localB,
      remote0,
      remoteA,
      remoteB,
    ] as Project[];
    expect(result).toEqual(sortedProjects);
  });
});
