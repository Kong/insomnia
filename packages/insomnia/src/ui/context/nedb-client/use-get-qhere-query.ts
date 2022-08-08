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

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetch = useCallback(() => {
    setLoading(true);
    dbClient.query
      .getWhere<T>(type, memoizedQuery.current)
      .then((found: T | null) => {
        setData(found);
        setLoading(false);
      }).catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [dbClient.query, type]);

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

    const unsubscribe = dbClient.onChange(channel, changeHandler);
    return unsubscribe();
  }, [dbClient, type]);

  return { data, loading, error, refetch: fetch };
}
