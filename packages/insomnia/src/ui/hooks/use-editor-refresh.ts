import { useEffect } from 'react';
import * as reactUse from 'react-use';

import { useRootLoaderData } from '~/root';

export const useEditorRefresh = (callback: () => void) => {
  const { settings } = useRootLoaderData()!;
  const { showVariableSourceAndValue, nunjucksPowerUserMode, hideSecretValuesInPreviewAndConsole } = settings;
  const previousShowVariableSourceAndValue = reactUse.usePrevious(showVariableSourceAndValue);
  const previousNunjucksPowerUserMode = reactUse.usePrevious(nunjucksPowerUserMode);
  const previousHideSecretValues = reactUse.usePrevious(hideSecretValuesInPreviewAndConsole);

  useEffect(() => {
    if (
      previousShowVariableSourceAndValue === undefined ||
      previousNunjucksPowerUserMode === undefined ||
      previousHideSecretValues === undefined
    ) {
      return;
    }

    if (
      previousShowVariableSourceAndValue === showVariableSourceAndValue &&
      previousNunjucksPowerUserMode === nunjucksPowerUserMode &&
      previousHideSecretValues === hideSecretValuesInPreviewAndConsole
    ) {
      return;
    }

    callback?.();
  }, [
    showVariableSourceAndValue,
    nunjucksPowerUserMode,
    hideSecretValuesInPreviewAndConsole,
    previousShowVariableSourceAndValue,
    previousNunjucksPowerUserMode,
    previousHideSecretValues,
    callback,
  ]);
};
