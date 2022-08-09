import { IpcRendererEvent } from 'electron';
import { useCallback, useEffect, useState } from 'react';
import { useDeepCompareEffect } from 'react-use';

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
  const [queryUsed, setQuery] = useState(query);
  

  useDeepCompareEffect(() => {
    setQuery(query);
  }, [query]);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetch = useCallback(() => {
    setLoading(true);
    dbClient.query
      .getWhere<T>(type, queryUsed)
      .then((found: T | null) => {
        setData(found);
        setLoading(false);
      }).catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [dbClient.query, type, queryUsed]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    const channel = `db.changes.${type}.${queryUsed._id}`;
    const changeHandler = (_: IpcRendererEvent, [operation, entity]: ChangeBufferEvent<T>) => {
      // TODO: add more operation case handling
      if (operation === 'update') {
        setData(entity);
        setLoading(false);
      }
    };

    const unsubscribe = dbClient.onChange(channel, changeHandler);
    unsubscribe();
  }, [dbClient, type, queryUsed]);

  return { data, loading, error, refetch: fetch };
}
