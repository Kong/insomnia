// @flow

import * as entities from '../ui/redux/modules/entities';

const reduxStateForTest = async (activeWorkspaceId: string): Promise<Object> => ({
  entities: entities.reducer({}, entities.initializeWith(await entities.allDocs())),
  global: { activeWorkspaceId },
});

export default reduxStateForTest;
