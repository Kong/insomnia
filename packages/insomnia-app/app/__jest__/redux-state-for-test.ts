import { ACTIVITY_HOME } from '../common/constants';
import { BASE_SPACE_ID } from '../models/space';
import { RootState } from '../ui/redux/modules';
import * as entities from '../ui/redux/modules/entities';
import { GlobalState } from '../ui/redux/modules/global';

export const reduxStateForTest = async (global: Partial<GlobalState> = {}): Promise<RootState> => ({
  entities: entities.reducer(entities.initialEntitiesState, entities.initializeWith(await entities.allDocs())),
  global: {
    activeWorkspaceId: null,
    activeActivity: ACTIVITY_HOME,
    activeSpaceId: BASE_SPACE_ID,
    spaceSortOrder: 'modified-desc',
    isLoading: false,
    isLoggedIn: false,
    loadingRequestIds: {},
    ...global,
  },
});
