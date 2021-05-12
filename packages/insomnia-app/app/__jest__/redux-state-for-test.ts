import * as entities from '../ui/redux/modules/entities';

const reduxStateForTest = async (activeWorkspaceId: string): Promise<Record<string, any>> => ({
  entities: entities.reducer({}, entities.initializeWith(await entities.allDocs())),
  global: {
    activeWorkspaceId,
  },
});

export default reduxStateForTest;
