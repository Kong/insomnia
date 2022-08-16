import { IpcRendererEvent } from 'electron';
import { useCallback, useEffect, useState } from 'react';

import { ChangeBufferEvent, ModelQuery, Query } from '../../../common/database';
import { BaseModel } from '../../../models';
import { useNeDBClient } from './nedb-client-context';

export interface UseGetWhereQuery<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}
type GetWhereQuery<T extends BaseModel> = ModelQuery<T> | (Query & Pick<BaseModel, '_id'>);
interface QueryDocument<T extends BaseModel> {
  operationName: string;
  type: string;
  query: GetWhereQuery<T>;
}
export function useGetWhereQuery<T extends BaseModel>(
  document: string,
): UseGetWhereQuery<T> {
  const dbClient = useNeDBClient();
  const [queryDocument, setQueryDocument] = useState<QueryDocument<T>>();

  useEffect(() => {
    try {
      const doc: QueryDocument<T> = JSON.parse(document);
      setQueryDocument(doc);
    } catch (error) {
      console.warn('Invalid QueryDocument');
    }
  }, [document]);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetch = useCallback(() => {
    if (!queryDocument) {
      return;
    }

    setLoading(true);
    const { type, query } = queryDocument;
    dbClient.query
      .getWhere<T>(type, query)
      .then((found: T | null) => {
        setData(found);
        setLoading(false);
      }).catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [dbClient.query, queryDocument]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!queryDocument) {
      return;
    }

    const { type, query } = queryDocument;
    const channel = `db.changes.${type}.${query._id}`;
    const changeHandler = (_: IpcRendererEvent, [operation, entity]: ChangeBufferEvent<T>) => {
      // @TODO: add more operation case handling
      if (operation === 'update') {
        setData(entity);
        setLoading(false);
      }
    };

    // @TODO: pass an option to opt out change listener
    const unsubscribe = dbClient.onChange(channel, changeHandler);
    unsubscribe();
  }, [dbClient, queryDocument]);

  return { data, loading, error, refetch: fetch };
}
