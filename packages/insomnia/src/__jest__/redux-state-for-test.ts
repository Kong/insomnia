import { ACTIVITY_HOME } from '../common/constants';
import { database } from '../common/database';
import { DEFAULT_PROJECT_ID, type } from '../models/project';
import { RootState } from '../ui/redux/modules';
import * as entities from '../ui/redux/modules/entities';
import { GlobalState } from '../ui/redux/modules/global';

export const reduxStateForTest = async (global: Partial<GlobalState> = {}): Promise<RootState> => {
  const allDocs = await entities.allDocs();
  const hasDefaultProject = allDocs.find(doc => doc._id === DEFAULT_PROJECT_ID);

  if (!hasDefaultProject) {
    const defaultProject = {
      _id: DEFAULT_PROJECT_ID,
      type: 'Project',
      name: 'Default',
      modified: Date.now(),
      created: Date.now(),
      parentId: 'n/a',
      isPrivate: true,
    };

    await database.docCreate(type, defaultProject);
    allDocs.push({
      _id: DEFAULT_PROJECT_ID,
      type: 'Project',
      name: 'Default',
      modified: Date.now(),
      created: Date.now(),
      parentId: 'n/a',
      isPrivate: true,
    });
  }

  return {
    entities: entities.reducer(entities.initialEntitiesState, entities.initializeWith(allDocs)),
    global: {
      activeWorkspaceId: null,
      activeActivity: ACTIVITY_HOME,
      activeProjectId: DEFAULT_PROJECT_ID,
      dashboardSortOrder: 'modified-desc',
      isLoggedIn: false,
      ...global,
    },
  };
};
