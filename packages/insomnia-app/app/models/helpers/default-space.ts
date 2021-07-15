import { getAppName } from '../../common/constants';
import { Space, BASE_SPACE_ID } from '../space';

export type SpaceSubset = Pick<Space, '_id' | 'name' | 'remoteId'>;

// TODO: this is a holdover until we have a default space always existing
export const defaultSpace: SpaceSubset = {
  _id: BASE_SPACE_ID,
  name: getAppName(),
  remoteId: null,
};
