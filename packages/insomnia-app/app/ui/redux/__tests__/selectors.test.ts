import { globalBeforeEach } from '../../../__jest__/before-each';
import { reduxStateForTest } from '../../../__jest__/redux-state-for-test';
import * as models from '../../../models';
import { DEFAULT_PROJECT_ID, Project } from '../../../models/project';
import { selectActiveProject } from '../selectors';

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
});
