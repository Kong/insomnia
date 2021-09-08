import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { SegmentEvent, trackEvent, trackSegmentEvent } from '../../../../common/analytics';
import { ACTIVITY_HOME } from '../../../../common/constants';
import * as models from '../../../../models';
import { DEFAULT_PROJECT_ID } from '../../../../models/project';
import { getAndClearShowAlertMockArgs, getAndClearShowPromptMockArgs } from '../../../../test-utils';
import { SET_ACTIVE_ACTIVITY, SET_ACTIVE_PROJECT } from '../global';
import { createProject, removeProject } from '../project';

jest.mock('../../../components/modals');
jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('project', () => {
  beforeEach(globalBeforeEach);
  describe('createProject', () => {
    it('should create project', async () => {
      const store = mockStore(await reduxStateForTest());
      store.dispatch(createProject());

      const {
        title,
        submitName,
        defaultValue,
        onComplete,
        cancelable,
        placeholder,
        selectText,
      } = getAndClearShowPromptMockArgs();

      expect(title).toBe('Create New Project');
      expect(submitName).toBe('Create');
      expect(cancelable).toBe(true);
      expect(defaultValue).toBe(placeholder);
      expect(placeholder).toBe('My Project');
      expect(selectText).toBe(true);

      const projectName = 'name';
      await onComplete?.(projectName);

      const projects = await models.project.all();
      expect(projects).toHaveLength(2);
      const project = projects[1];
      expect(project.name).toBe(projectName);
      expect(trackSegmentEvent).toHaveBeenCalledWith(SegmentEvent.projectLocalCreate);
      expect(trackEvent).toHaveBeenCalledWith('Project', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: project._id,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_HOME,
        },
      ]);
    });
  });

  describe('removeProject', () => {
    it('should remove project', async () => {
      const store = mockStore(await reduxStateForTest());
      const projectOne = await models.project.create({ name: 'My Project' });
      const projectTwo = await models.project.create();

      store.dispatch(removeProject(projectOne));

      const {
        title,
        message,
        addCancel,
        okLabel,
        onConfirm,
      } = getAndClearShowAlertMockArgs();

      expect(title).toBe('Delete Project');
      expect(message).toBe('Deleting a project will delete all documents and collections within. This cannot be undone. Are you sure you want to delete My Project?');
      expect(addCancel).toBe(true);
      expect(okLabel).toBe('Delete');

      await expect(models.project.all()).resolves.toHaveLength(3);

      await onConfirm();

      const projects = await models.project.all();
      expect(projects).toHaveLength(2);
      const project = projects[1];
      expect(project).toStrictEqual(projectTwo);
      expect(trackSegmentEvent).toHaveBeenCalledWith(SegmentEvent.projectLocalDelete);
      expect(trackEvent).toHaveBeenCalledWith('Project', 'Delete');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: DEFAULT_PROJECT_ID,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_HOME,
        },
      ]);
    });
  });
});
