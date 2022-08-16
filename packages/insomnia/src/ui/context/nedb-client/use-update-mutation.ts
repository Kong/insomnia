import { useCallback, useState } from 'react';

import { BaseModel } from '../../../models';
import { useNeDBClient } from './nedb-client-context';

interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}
type MutateMethod<T> = (updates: Partial<T>) => Promise<void>;
type UseUpdateMutation<T> = [MutateMethod<T>, QueryResult<T>];
export function useUpdateMutation<T extends BaseModel>(original: T | null): UseUpdateMutation<T> {
  const dbClient = useNeDBClient();

  const [data, setData] = useState<T | null>(original);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const mutateEntity = useCallback(async (updates: Partial<T>): Promise<void> => {
    if (original) {
      setLoading(true);
      return dbClient.mutation
        .docUpdate(original, updates)
        .then((updated: T) => {
          setData(updated);
          setLoading(true);
        }).catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [dbClient.mutation, original]);

  return [mutateEntity, { data, loading, error }];
}
