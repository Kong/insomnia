import { StatusCandidate } from '../../sync/types';
import { BaseModel, canSync } from '..';

const toStatusCandidate = (doc: BaseModel): StatusCandidate => ({
  key: doc._id,
  name: doc.name || '',
  document: doc,
});

export const getStatusCandidates = (docs: BaseModel[]) => docs.filter(canSync).map(toStatusCandidate);
