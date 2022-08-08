import { useCallback, useState } from 'react';

import { BaseModel } from '../../../models';
import { useNeDBClient } from './nedb-client-context';

interface UseUpdateMutation<T> {
    data: T | null;
    loading: boolean;
    error: boolean;
    updateEntity: (updates: Partial<T>) => Promise<void>;
  }
export function useUpdateMutation<T extends BaseModel>(original: T | null): UseUpdateMutation<T> {
  const dbClient = useNeDBClient();

  const [data, setData] = useState<T | null>(original);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const updateEntity = useCallback(async (updates: Partial<T>): Promise<void> => {
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

  return { data, loading, error, updateEntity };
}
