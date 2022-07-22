import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { ChangeBufferEvent, database } from '../../../../common/database';
import * as models from '../../../../models';
import { OAuth2Token, type } from '../../../../models/o-auth-2-token';
import { selectActiveOAuth2Token } from '../../../redux/selectors';

interface Oauth2TokenData {
  token: OAuth2Token | undefined;
  loading: boolean;
}
type UseOauth2TokenClear  = [Oauth2TokenData, () => void];
export function useOauth2TokenClear(): UseOauth2TokenClear {
  const token = useSelector(selectActiveOAuth2Token);
  const [loading, setLoading] = useState(false);

  const clearTokens = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    await models.oAuth2Token.remove(token);
  }, [token]);

  useEffect(() => {
    function listener(changes: ChangeBufferEvent[]): void {
      for (const change of changes) {
        const [operationEvent, entity] = change;
        if (entity.type === type && operationEvent === database.CHANGE_REMOVE) {
          setLoading(false);
        }
      }
    }

    database.onChange(listener);
    return () => database.offChange(listener);
  }, [token]);

  return [{ token, loading }, clearTokens];
}
