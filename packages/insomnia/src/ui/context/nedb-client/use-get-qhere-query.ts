import { IpcRendererEvent } from 'electron';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ChangeBufferEvent, ModelQuery, Query } from '../../../common/database';
import { BaseModel } from '../../../models';
import { useNeDBClient } from './nedb-client-context';

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
  const dbClient = useNeDBClient();
  const memoizedQuery = useRef<GetWhereQuery<T>>(query);

  const [queryId, setQueryId] = useState(query._id);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetch = useCallback(() => {
    setLoading(true);
    const query = { ...memoizedQuery.current, _id: queryId };
    dbClient.query
      .getWhere<T>(type, query)
      .then((found: T | null) => {
        setData(found);
        setLoading(false);
      }).catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [dbClient.query, type, queryId]);

  useEffect(() => {
    memoizedQuery.current = query;
    setQueryId(query._id);
  }, [query]);

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

    const unsubscribe = dbClient.onChange(channel, changeHandler);
    unsubscribe();
  }, [dbClient, type]);

  return { data, loading, error, refetch: fetch };
}
