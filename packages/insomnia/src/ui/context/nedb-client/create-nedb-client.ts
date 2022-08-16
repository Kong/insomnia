import { database } from '../../../common/database';

export interface NeDBClientQuery {
  all: typeof database.all;
  getWhere: typeof database.getWhere;
}
export interface NeDBClientMutation {
  docUpdate: typeof database.docUpdate;
}
export interface NeDBClient {
  query: NeDBClientQuery;
  mutation: NeDBClientMutation;
  onChange: typeof window.main.on;
}
/**
 * this function is created to return an object to abstract from the actual database object, so we can actually mock the behaviour of the database instead of setting it up in the jest environment.
 * @returns an object that interfaces the NeDB object wrapper (database.ts)
 */
export function createNeDBClient(): NeDBClient {
  const query = {
    all: database.all,
    getWhere: database.getWhere,
  };
  const mutation = {
    docUpdate: database.docUpdate,
  };
  return {
    query,
    mutation,
    onChange: window.main.on, // TODO: make a dedicated ipc channel for this
  };
}
