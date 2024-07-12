import { useEffect } from 'react';
import { usePrevious } from 'react-use';

import { useRootLoaderData } from '../routes/root';

export const useEditorRefresh = (callback: () => void) => {
  const { settings } = useRootLoaderData();
  const { showVariableSourceAndValue, nunjucksPowerUserMode } = settings;
  const previousShowVariableSourceAndValue = usePrevious(showVariableSourceAndValue);
  const previousNunjucksPowerUserMode = usePrevious(nunjucksPowerUserMode);

  useEffect(() => {
    if (previousShowVariableSourceAndValue === undefined || previousNunjucksPowerUserMode === undefined) {
      return;
    }

    if (previousShowVariableSourceAndValue === showVariableSourceAndValue && previousNunjucksPowerUserMode === nunjucksPowerUserMode) {
      return;
    }

    callback?.();
  }, [showVariableSourceAndValue, nunjucksPowerUserMode, previousShowVariableSourceAndValue, previousNunjucksPowerUserMode, callback]);

};
