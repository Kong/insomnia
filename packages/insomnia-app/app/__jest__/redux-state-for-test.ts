import { ACTIVITY_DEBUG } from '../common/constants';
import { RootState } from '../ui/redux/modules';
import * as entities from '../ui/redux/modules/entities';
import { GlobalState } from '../ui/redux/modules/global';

const reduxStateForTest = async (global: Partial<GlobalState> = {}): Promise<RootState> => ({
  entities: entities.reducer(entities.initialEntitiesState, entities.initializeWith(await entities.allDocs())),
  global: {
    activeWorkspaceId: null,
    activeActivity: ACTIVITY_DEBUG,
    activeSpaceId: null,
    isLoading: false,
    isLoggedIn: false,
    loadingRequestIds: {},
    ...global,
  },
});

export default reduxStateForTest;
