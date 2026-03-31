import { models, services } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

const defaultOrgProject = await services.project.create({
  name: 'a',
  remoteId: 'proj_team_123456789345678987654',
  _id: 'not important',
});

const remoteA = await services.project.create({ name: 'a', remoteId: 'notNull', _id: 'remoteA' });
const remoteB = await services.project.create({ name: 'b', remoteId: 'notNull', _id: 'remoteB' });
const remote0 = await services.project.create({ name: '0', remoteId: 'notNull', _id: 'remote0' });

const { sortProjects } = models.project;

describe('sortProjects', () => {
  it('sorts projects by default > local > remote > name', () => {
    const unSortedProjects = [remoteA, defaultOrgProject, remoteB, remote0];
    const result = sortProjects(unSortedProjects);

    const sortedProjects = [defaultOrgProject, remote0, remoteA, remoteB];
    expect(result).toEqual(sortedProjects);
  });
});
