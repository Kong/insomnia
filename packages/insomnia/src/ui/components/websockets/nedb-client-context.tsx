import { IpcRendererEvent } from 'electron';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { ChangeBufferEvent, database, ModelQuery, Query } from '../../../common/database';
import { BaseModel } from '../../../models';

interface NeDBClientQuery {
  all: typeof database.all;
  getWhere: typeof database.getWhere;
}
interface NeDBClientMutation {
  docUpdate: typeof database.docUpdate;
}
interface NeDBClient {
  query: NeDBClientQuery;
  mutation: NeDBClientMutation;
  onChange: typeof window.main.on;
}
/**
 * this function is created to return an object to abstract from the actual database object, so we can actually mock the behaviour of the database instead of setting it up in the jest environment.
 * @returns an object that interfaces the NeDB object wrapper (database.ts)
 */
function createNeDBClient(): NeDBClient {
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
const client = createNeDBClient();
const NeDBClientContext = createContext<NeDBClient | undefined>(undefined);
export const NeDBClientProvider = ({ children }: { children: ReactNode }) => {
  return (
    <NeDBClientContext.Provider value={client}>
      {children}
    </NeDBClientContext.Provider>
  );
};
function useNeDBClient(): NeDBClient {
  const context = useContext(NeDBClientContext);
  if (!context) {
    throw new Error('Use useWebSocketClient hook with <WebSocketClientProvider /> ');
  }

  return context;
}

interface UseGetWhereQuery<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}
type GetWhereQuery<T extends BaseModel> = ModelQuery<T> | (Query & Pick<BaseModel, '_id'>);
export function useGetWhereQuery<T extends BaseModel>(
  type: string,
  query: GetWhereQuery<T>,
): UseGetWhereQuery<T> {
  const db = useNeDBClient();
  const memoizedQuery = useRef<GetWhereQuery<T>>(query);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetch = useCallback(() => {
    setLoading(true);
    db.query
      .getWhere(type, memoizedQuery.current)
      .then((found: T | null) => {
        setData(found);
        setLoading(false);
      }).catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [db.query, type]);

  useEffect(() => {
    memoizedQuery.current = query;
  });

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    const channel = `db.changes.${type}.${memoizedQuery.current._id}`;
    const changeHandler = (_: IpcRendererEvent, [operation, entity]: ChangeBufferEvent<T>) => {
      // TODO: add more operation case handling
      if (operation === 'update') {
        setData(entity);
        setLoading(false);
      }
    };

    const unsubscribe = window.main.on(channel, changeHandler);
    return unsubscribe();
  }, [type]);

  return { data, loading, error, refetch: fetch };
}
interface UseUpdateMutation<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  updateEntity: (updates: Partial<T>) => Promise<void>;
}
export function useUpdateMutation<T extends BaseModel>(original: T | null): UseUpdateMutation<T> {
  const db = useNeDBClient();

  const [data, setData] = useState<T | null>(original);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const updateEntity = useCallback(async (updates: Partial<T>): Promise<void> => {
    if (original) {
      setLoading(true);
      return db.mutation
        .docUpdate(original, updates)
        .then((updated: T) => {
          setData(updated);
          setLoading(true);
        }).catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [db.mutation, original]);

  return { data, loading, error, updateEntity };
}
