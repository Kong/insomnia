import { describe, expect, it } from '@jest/globals';

import { sortProjects } from '../project';

const defaultOrgProject = { name: 'a', remoteId: 'proj_team_123456789345678987654', _id: 'not important' };

const remoteA = { name: 'a', remoteId: 'notNull', _id: 'remoteA' };
const remoteB = { name: 'b', remoteId: 'notNull', _id: 'remoteB' };
const remote0 = { name: '0', remoteId: 'notNull', _id: 'remote0' };

describe('sortProjects', () => {
  it('sorts projects by default > local > remote > name', () => {
    const unSortedProjects = [
      remoteA,
      defaultOrgProject,
      remoteB,
      remote0,
    ];
    const result = sortProjects(unSortedProjects);

    const sortedProjects = [
      defaultOrgProject,
      remote0,
      remoteA,
      remoteB,
    ];
    expect(result).toEqual(sortedProjects);
  });
});
