import { useEffect } from 'react';
import * as reactUse from 'react-use';

import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';

export const useEditorRefresh = (callback: () => void) => {
  const { settings } = useRootLoaderData()!;
  const { showVariableSourceAndValue, nunjucksPowerUserMode } = settings;
  const previousShowVariableSourceAndValue = reactUse.usePrevious(showVariableSourceAndValue);
  const previousNunjucksPowerUserMode = reactUse.usePrevious(nunjucksPowerUserMode);

  useEffect(() => {
    if (previousShowVariableSourceAndValue === undefined || previousNunjucksPowerUserMode === undefined) {
      return;
    }

    if (
      previousShowVariableSourceAndValue === showVariableSourceAndValue &&
      previousNunjucksPowerUserMode === nunjucksPowerUserMode
    ) {
      return;
    }

    callback?.();
  }, [
    showVariableSourceAndValue,
    nunjucksPowerUserMode,
    previousShowVariableSourceAndValue,
    previousNunjucksPowerUserMode,
    callback,
  ]);
};
