import { BaseModel, canSync } from '..';
import { StatusCandidate } from '../../sync/types';

const toStatusCandidate = (doc: BaseModel): StatusCandidate => ({
  key: doc._id,
  name: doc.name || '',
  document: doc,
});

export const getStatusCandidates = (docs: BaseModel[]) => docs.filter(canSync).map(toStatusCandidate);
