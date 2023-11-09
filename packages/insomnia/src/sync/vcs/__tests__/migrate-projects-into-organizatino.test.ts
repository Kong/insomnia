import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { _migrateToCloudSync, _migrateToLocalVault, _validateProjectsWithRemote, scanForMigration, shouldMigrate } from '../migrate-projects-into-organization';
import { fakeDatabase, mockRemoteBackgroundCheck, mockRemoteBackgroundCheckMessedUp, mocksHiddenWorkspaces, mocksNoProblem, mocksToBeRepaired, mocksWithoutParentIdProjects } from './database.mock';

console.log({
  _migrateToCloudSync, _migrateToLocalVault, _validateProjectsWithRemote,
});
describe('scanForMigration()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
  });
  it('should scan all the untracked projects and files (both files under projects and un parent project files)', async () => {
    await fakeDatabase(mocksWithoutParentIdProjects);

    const result = await scanForMigration();
    console.log(result.filesByProject.size);
    expect(result.filesByProject.size).toBe(3);

    expect(result.filesByProject.has('wrk_2'));
    expect(result.filesByProject.has('wrk_3'));
    expect(result.filesByProject.has('wrk_4'));
    expect(result.filesNoProject.size).toBe(1);
    expect(result.filesNoProject.has('wrk_1'));
    expect(result.projects.size).toBe(3);
    expect(result.projects.has('proj_1'));
    expect(result.projects.has('proj_2'));
    expect(result.projects.has('proj_3'));
  });

  it('should scan all the untracked files (only files)', async () => {
    await fakeDatabase(mocksHiddenWorkspaces);

    const result = await scanForMigration();
    expect(result.filesByProject.size).toBe(0);
    expect(result.filesNoProject.size).toBe(3);
    expect(result.filesNoProject.has('wrk_2'));
    expect(result.filesNoProject.has('wrk_3'));
    expect(result.filesNoProject.has('wrk_4'));
    expect(result.projects.size).toBe(0);
  });

  it('should scan when there are no untracked projects and files', async () => {
    await fakeDatabase(mocksNoProblem);

    const result = await scanForMigration();
    expect(result.filesByProject.size).toBe(0);
    expect(result.filesNoProject.size).toBe(0);
    expect(result.projects.size).toBe(0);
  });
});

describe('shouldMigrate()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
  });
  it('should return true with untracked projects and files (both files under projects and un parent project files)', async () => {
    await fakeDatabase(mocksWithoutParentIdProjects);

    const queue = await scanForMigration();
    const result = await shouldMigrate(queue);
    expect(result).toBeTruthy();
  });

  it('should return true with untracked files (only files)', async () => {
    await fakeDatabase(mocksHiddenWorkspaces);

    const queue = await scanForMigration();
    const result = await shouldMigrate(queue);
    expect(result).toBeTruthy();
  });

  it('should return false with no untracked files', async () => {
    await fakeDatabase(mocksNoProblem);

    const queue = await scanForMigration();
    const result = await shouldMigrate(queue);
    expect(result).not.toBeTruthy();
  });
});

describe('_migrateToCloudSync()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
  });

  it('should fallback to local migration when there are no valid remote projects', async () => {
    await fakeDatabase(mocksWithoutParentIdProjects);

    const queue = await scanForMigration();
    const records = await _migrateToCloudSync(queue, mockRemoteBackgroundCheckMessedUp);

    expect(records.filesForSync.length).toBe(0);
    expect(records.projects.size).toBe(3);
    expect(records.projects.has('proj_1')).toBeTruthy();
    expect(records.projects.has('proj_2')).toBeTruthy();
    expect(records.projects.has('proj_3')).toBeTruthy();
    const [proj1, proj2, proj3] = await Promise.all([
      models.project.getById(records.projects.get('proj_1')!),
      models.project.getById(records.projects.get('proj_2')!),
      models.project.getById(records.projects.get('proj_3')!),
    ]);
    expect(proj1).toBeTruthy();
    expect(proj1!.remoteId).toBeNull();
    expect(proj2).toBeTruthy();
    expect(proj2!.remoteId).toBeNull();
    expect(proj3).toBeTruthy();
    expect(proj3!.remoteId).toBeNull();

    expect(records.files.size).toBe(4);
    expect(records.files.has('wrk_1')).toBeTruthy();
    expect(records.files.has('wrk_2')).toBeTruthy(); // part of proj_3
    expect(records.files.has('wrk_3')).toBeTruthy(); // part of proj_3
    expect(records.files.has('wrk_4')).toBeTruthy(); // part of proj_3
  });

  it('should repair projects with valid remote ids with personal workspace id if not linked correctly', async () => {
    await fakeDatabase(mocksToBeRepaired);

    const beforeProj1 = await models.project.getById('proj_1');
    expect(beforeProj1!.parentId).toBeNull();

    const beforeProj2 = await models.project.getById('proj_2');
    expect(beforeProj2!.parentId).toBeNull();

    const queue = await scanForMigration();
    const records = await _migrateToCloudSync(queue, mockRemoteBackgroundCheck);

    expect(records.projects.size).toBe(1);
    expect(records.files.size).toBe(4); // => we've duplicated the files because they are not in correct linking between the local and remote

    const repairedProj1 = await models.project.getById('proj_1');
    expect(repairedProj1!.parentId).toBe('org_my');

    const repairedProj2 = await models.project.getById('proj_2');
    expect(repairedProj2!.parentId).toBe('org_my');

    const [wrk1, wrk2, wrk3, wrk4] = await Promise.all([
      models.workspace.getById(records.files.get('wrk_1')!),
      models.workspace.getById(records.files.get('wrk_2')!),
      models.workspace.getById(records.files.get('wrk_3')!),
      models.workspace.getById(records.files.get('wrk_4')!),
    ]);

    expect(wrk1!.parentId).not.toBeNull(); // files without parent id (no project linking) => now corrected
    expect(wrk2!.parentId).not.toBe('proj_3'); // files with the parent id that does not exist in the cloud => duplicated and linked to the existing remote project
    expect(wrk3!.parentId).not.toBe('proj_3'); // files with the parent id that does not exist in the cloud => duplicated and linked to the existing remote project
    expect(wrk4!.parentId).not.toBe('proj_3'); // files with the parent id that does not exist in the cloud => duplicated and linked to the existing remote project

    // these duplicated 4 files need to be synced now
    expect(records.filesForSync.length).toBe(4);
  });
});

describe('_migrateToLocalVault()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
  });

  it('should duplicate all files and projects', async () => {
    await fakeDatabase(mocksWithoutParentIdProjects);

    const queue = await scanForMigration();
    const records = await _migrateToLocalVault(queue, mockRemoteBackgroundCheck);

    // should never happen
    expect(records).not.toHaveProperty('filesForSync');
    expect(records.projects.size).toBe(3);
    expect(records.projects.has('proj_1')).toBeTruthy();
    expect(records.projects.has('proj_2')).toBeTruthy();
    expect(records.projects.has('proj_3')).toBeTruthy();
    expect(records.files.size).toBe(4);
    expect(records.files.has('wrk_1')).toBeTruthy();
    expect(records.files.has('wrk_2')).toBeTruthy(); // part of proj_3
    expect(records.files.has('wrk_3')).toBeTruthy(); // part of proj_3
    expect(records.files.has('wrk_4')).toBeTruthy(); // part of proj_3
  });

  it('should link untracked files to a newly created local vault', async () => {
    await fakeDatabase(mocksHiddenWorkspaces);

    const queue = await scanForMigration();
    const records = await _migrateToLocalVault(queue, mockRemoteBackgroundCheck);
    expect(records).not.toHaveProperty('filesForSync');
    expect(records.projects.size).toBe(0);
    expect(records.projects.has('proj_1')).not.toBeTruthy();
    expect(records.files.size).toBe(3);
    expect(records.files.has('wrk_1')).not.toBeTruthy(); // part of proj_1
    expect(records.files.has('wrk_2')).toBeTruthy();
    expect(records.files.has('wrk_3')).toBeTruthy();
    expect(records.files.has('wrk_4')).toBeTruthy();

    const [wrk1, wrk2, wrk3, wrk4] = await Promise.all([
      models.workspace.getById('wrk_1'),
      models.workspace.getById(records.files.get('wrk_2')),
      models.workspace.getById(records.files.get('wrk_3')),
      models.workspace.getById(records.files.get('wrk_4')),
    ]);

    expect(wrk1).toMatchObject({});
    expect(wrk2).toBeTruthy();
    expect(wrk2!.parentId).not.toBeNull();

    const { parentId: newVaultId } = wrk2!;
    expect(wrk3).toBeTruthy();
    expect(wrk3!.parentId).toEqual(newVaultId);
    expect(wrk4).toBeTruthy();
    expect(wrk4!.parentId).toEqual(newVaultId);
  });
});
