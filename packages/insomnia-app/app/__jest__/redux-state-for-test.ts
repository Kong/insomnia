import { ACTIVITY_HOME } from '../common/constants';
import { DEFAULT_PROJECT_ID } from '../models/project';
import { RootState } from '../ui/redux/modules';
import * as entities from '../ui/redux/modules/entities';
import { GlobalState } from '../ui/redux/modules/global';

export const reduxStateForTest = async (global: Partial<GlobalState> = {}): Promise<RootState> => ({
  entities: entities.reducer(entities.initialEntitiesState, entities.initializeWith(await entities.allDocs())),
  global: {
    activeWorkspaceId: null,
    activeActivity: ACTIVITY_HOME,
    activeProjectId: DEFAULT_PROJECT_ID,
    dashboardSortOrder: 'modified-desc',
    isLoading: false,
    isLoggedIn: false,
    loadingRequestIds: {},
    ...global,
  },
});
