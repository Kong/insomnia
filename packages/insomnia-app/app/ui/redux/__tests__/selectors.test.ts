import { globalBeforeEach } from '../../../__jest__/before-each';
import { reduxStateForTest } from '../../../__jest__/redux-state-for-test';
import * as models from '../../../models';
import { BASE_PROJECT_ID, Project } from '../../../models/project';
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

    it('should return base project if active project not found', async () => {
      // create two projects
      await models.project.create();
      await models.project.create();

      // set first as selected
      const state = await reduxStateForTest({ activeProjectId: 'some-other-space' });

      const project = selectActiveProject(state);
      expect(project).toStrictEqual(expect.objectContaining<Partial<Project>>({ _id: BASE_PROJECT_ID }));
    });

    it('should return base project if no active project', async () => {
      // create two projects
      await models.project.create();
      await models.project.create();

      // set base as selected
      const state = await reduxStateForTest({ activeProjectId: undefined });

      const project = selectActiveProject(state);
      expect(project).toStrictEqual(expect.objectContaining<Partial<Project>>({ _id: BASE_PROJECT_ID }));
    });
  });
});
