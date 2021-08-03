import * as models from '../../models';
import { RemoteSpace } from '../../models/space';
import { Team } from '../types';

export const initializeSpaceFromTeam = (team: Team) => models.initModel<RemoteSpace>(
  models.space.type,
  {
    _id: `${models.space.prefix}_${team.id}`,
    remoteId: team.id,
    name: team.name,
  }
);