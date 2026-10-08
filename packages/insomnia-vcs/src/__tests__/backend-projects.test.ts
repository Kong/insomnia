import { createBuilder } from '@develohpanda/fluent-builder';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { projectSchema } from '../__schemas__/type-schemas';
import { getBackendProjectById, hasBackendProjectForRootDocument, storeBackendProject } from '../backend-projects';
import { configureStore } from '../store/current-store';
import MemoryDriver from '../store/drivers/memory-driver';
import type { BackendProject } from '../types';

const projectBuilder = createBuilder(projectSchema);

describe('hasBackendProjectForRootDocument', () => {
  let driver: MemoryDriver;
  let backendProject: BackendProject;

  beforeEach(async () => {
    backendProject = projectBuilder.reset().build();

    driver = new MemoryDriver();
    configureStore(driver);

    driver.setItem('/projects/', Buffer.from(JSON.stringify([backendProject])));
    driver.setItem(`/projects/${backendProject.id}/`, Buffer.from(''));
    driver.setItem(`/projects/${backendProject.id}/meta.json`, Buffer.from(JSON.stringify(backendProject)));
  });

  it('should return true if has project', async () => {
    const hasProject = await hasBackendProjectForRootDocument(backendProject.rootDocumentId);

    expect(hasProject).toBe(true);
  });

  it('should return false if has no project', async () => {
    const hasProject = await hasBackendProjectForRootDocument('some other id');

    expect(hasProject).toBe(false);
  });
});

describe('storeBackendProject()', () => {
  let driver: MemoryDriver;
  let backendProject: BackendProject;

  beforeEach(() => {
    driver = new MemoryDriver();
    configureStore(driver);
    backendProject = projectBuilder.reset().build();
  });

  it('writes backend project metadata when missing', async () => {
    const setItemSpy = vi.spyOn(driver, 'setItem');

    await storeBackendProject(backendProject);

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(`/projects/${backendProject.id}/meta.json`, expect.any(Buffer));
    expect(await getBackendProjectById(backendProject.id)).toEqual(backendProject);
  });

  it('skips identical backend project metadata writes', async () => {
    const setItemSpy = vi.spyOn(driver, 'setItem');

    await storeBackendProject(backendProject);
    setItemSpy.mockClear();

    await storeBackendProject(backendProject);

    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('writes changed backend project metadata', async () => {
    const setItemSpy = vi.spyOn(driver, 'setItem');
    const updatedProject = {
      ...backendProject,
      name: `${backendProject.name} Updated`,
    };

    await storeBackendProject(backendProject);
    setItemSpy.mockClear();

    await storeBackendProject(updatedProject);

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(await getBackendProjectById(backendProject.id)).toEqual(updatedProject);
  });

  it('writes backend project metadata when existing meta.json is corrupted', async () => {
    await driver.setItem(`/projects/${backendProject.id}/meta.json`, Buffer.from('{', 'utf8'));
    const setItemSpy = vi.spyOn(driver, 'setItem');

    await storeBackendProject(backendProject);

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(`/projects/${backendProject.id}/meta.json`, expect.any(Buffer));
  });
});
