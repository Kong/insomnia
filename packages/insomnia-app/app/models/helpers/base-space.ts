import { getAppName } from '../../common/constants';
import { BASE_SPACE_ID, Space } from '../space';

export type SpaceSubset = Pick<Space, '_id' | 'name' | 'remoteId'>;

// TODO: this is a holdover until we have a default space always existing
export const baseSpace: SpaceSubset = {
  _id: BASE_SPACE_ID,
  name: getAppName(),
  remoteId: null,
};
