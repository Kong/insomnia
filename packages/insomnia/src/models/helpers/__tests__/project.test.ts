import { describe, expect, it } from '@jest/globals';

import { DEFAULT_PROJECT_ID } from '../../project';
import { sortProjects } from '../project';

const defaultProject = { name: 'a', remoteId: null, _id: DEFAULT_PROJECT_ID, dashboardSortOrder: 'modified-desc' };

const localA = { name: 'a', remoteId: null, _id: 'localA', dashboardSortOrder: 'modified-desc'  };
const localB = { name: 'b', remoteId: null, _id: 'localB', dashboardSortOrder: 'modified-desc'  };

const remoteA = { name: 'a', remoteId: 'notNull', _id: 'remoteA', dashboardSortOrder: 'modified-desc' };
const remoteB = { name: 'b', remoteId: 'notNull', _id: 'remoteB', dashboardSortOrder: 'modified-desc' };
const remote0 = { name: '0', remoteId: 'notNull', _id: 'remote0', dashboardSortOrder: 'modified-desc' };

describe('sortProjects', () => {
  it('sorts projects by default > local > remote > name', () => {
    const unSortedProjects = [
      remoteA,
      localB,
      defaultProject,
      remoteB,
      localA,
      remote0,
    ];
    const result = sortProjects(unSortedProjects);

    const sortedProjects = [
      defaultProject,
      localA,
      localB,
      remote0,
      remoteA,
      remoteB,
    ];
    expect(result).toEqual(sortedProjects);
  });
});
