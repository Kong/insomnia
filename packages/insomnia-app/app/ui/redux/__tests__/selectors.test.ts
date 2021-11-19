import { globalBeforeEach } from '../../../__jest__/before-each';
import { reduxStateForTest } from '../../../__jest__/redux-state-for-test';
import { ACTIVITY_DEBUG, ACTIVITY_HOME } from '../../../common/constants';
import * as models from '../../../models';
import { DEFAULT_PROJECT_ID, Project } from '../../../models/project';
import { WorkspaceScopeKeys } from '../../../models/workspace';
import { selectActiveApiSpec, selectActiveProject, selectActiveWorkspaceName, selectWorkspacesWithResolvedNameForActiveProject } from '../selectors';

describe('selectors', () => {
  beforeEach(globalBeforeEach);

  describe('selectActiveProject', () => {
    it('should return the active project', async () => {
      // create two projects
      const projectA = await models.project.create();
      await models.project.create();

      // set first as selected
      const state = await reduxStateForTest({ activeProjectId: projectA._id });

      const project = selectActiveProject(state);
      expect(project).toStrictEqual(projectA);
    });

    it('should return default project if active project not found', async () => {
      // create two projects
      await models.project.create();
      await models.project.create();

      // set first as selected
      const state = await reduxStateForTest({ activeProjectId: 'some-other-project' });

      const project = selectActiveProject(state);
      expect(project).toStrictEqual(expect.objectContaining<Partial<Project>>({ _id: DEFAULT_PROJECT_ID }));
    });

    it('should return default project if no active project', async () => {
      // create two projects
      await models.project.create();
      await models.project.create();

      // set nothing as active
      const state = await reduxStateForTest({ activeProjectId: undefined });

      const project = selectActiveProject(state);
      expect(project).toStrictEqual(expect.objectContaining<Partial<Project>>({ _id: DEFAULT_PROJECT_ID }));
    });
  });

  describe('selectActiveApiSpec', () => {
    it('will return undefined when there is not an active workspace', async () => {
      const state = await reduxStateForTest({
        activeWorkspaceId: null,
      });

      expect(selectActiveApiSpec(state)).toBe(undefined);
    });

    it('will return throw when there is not an active apiSpec', async () => {
      const workspace = await models.workspace.create({
        name: 'workspace.name',
        scope: WorkspaceScopeKeys.design,
      });

      const state = await reduxStateForTest({
        activeActivity: ACTIVITY_DEBUG,
        activeWorkspaceId: workspace._id,
      });
      state.entities.apiSpecs = {};

      const execute = () => selectActiveApiSpec(state);
      expect(execute).toThrowError(`an api spec not found for the workspace ${workspace._id} (workspace.name)`);
    });

    it('will return the apiSpec for a given workspace', async () => {
      const workspace = await models.workspace.create({
        name: 'workspace.name',
        scope: WorkspaceScopeKeys.design,
      });
      const spec = await models.apiSpec.updateOrCreateForParentId(
        workspace._id,
        { fileName: 'apiSpec.fileName' },
      );

      const state = await reduxStateForTest({
        activeActivity: ACTIVITY_DEBUG,
        activeWorkspaceId: workspace._id,
      });

      expect(selectActiveApiSpec(state)).toEqual(spec);
    });
  });

  describe('selectActiveWorkspaceName', () => {
    it('returns workspace name for collections', async () => {
      const workspace = await models.workspace.create({
        name: 'workspace.name',
        scope: WorkspaceScopeKeys.collection,
      });
      // even though this shouldn't technically happen, we want to make sure the selector still makes the right decision (and ignores the api spec for collections)
      await models.apiSpec.updateOrCreateForParentId(
        workspace._id,
        { fileName: 'apiSpec.fileName' },
      );
      const state = await reduxStateForTest({
        activeActivity: ACTIVITY_DEBUG,
        activeWorkspaceId: workspace._id,
      });

      expect(selectActiveWorkspaceName(state)).toBe('workspace.name');
    });

    it('returns api spec name for design documents', async () => {
      const workspace = await models.workspace.create({
        name: 'workspace.name',
        scope: WorkspaceScopeKeys.design,
      });
      await models.apiSpec.updateOrCreateForParentId(
        workspace._id,
        { fileName: 'apiSpec.fileName' },
      );
      const state = await reduxStateForTest({
        activeActivity: ACTIVITY_DEBUG,
        activeWorkspaceId: workspace._id,
      });

      expect(selectActiveWorkspaceName(state)).toBe('apiSpec.fileName');
    });

    it('returns undefined when there is not an active workspace', async () => {
      await models.workspace.create({
        name: 'workspace.name',
        scope: WorkspaceScopeKeys.collection,
      });
      const state = await reduxStateForTest({
        activeActivity: ACTIVITY_DEBUG,
        activeWorkspaceId: null,
      });

      expect(selectActiveWorkspaceName(state)).toBe(undefined);
    });
  });

  describe('selectWorkspacesWithResolvedNameForActiveProject', () => {
    it('returns the workspaces with resolved names for the active project', async () => {
      const newCollectionWorkspace = await models.workspace.create({
        name: 'collectionWorkspace.name',
        scope: WorkspaceScopeKeys.collection,
      });

      const newDesignWorkspace = await models.workspace.create({
        name: 'designWorkspace.name',
        scope: WorkspaceScopeKeys.design,
      });

      const newApiSpec = await models.apiSpec.getOrCreateForParentId(
        newDesignWorkspace._id
      );

      // The database will update the api spec with the workspace name
      // That's why we need to explicitly update the ApiSpec name
      await models.apiSpec.update(newApiSpec, {
        fileName: 'apiSpec.name',
      });

      const state = await reduxStateForTest({
        activeActivity: ACTIVITY_HOME,
        activeWorkspaceId: null,
      });

      const workspaces = selectWorkspacesWithResolvedNameForActiveProject(state);

      const designWorkspace = workspaces.find(
        workspace => workspace._id === newDesignWorkspace._id
      );

      const collectionWorkspace = workspaces.find(
        workspace => workspace._id === newCollectionWorkspace._id
      );

      expect(
        designWorkspace
      ).toMatchObject(
        {
          _id: newDesignWorkspace._id,
          name: 'apiSpec.name',
          scope: WorkspaceScopeKeys.design,
          type: 'Workspace',
        },
      );

      expect(
        collectionWorkspace
      ).toMatchObject(
        {
          _id: newCollectionWorkspace._id,
          name: 'collectionWorkspace.name',
          scope: WorkspaceScopeKeys.collection,
          type: 'Workspace',
        },
      );
    });
  });
});
