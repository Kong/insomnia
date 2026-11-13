import { useEffect } from 'react';
import * as reactUse from 'react-use';

import { useHideSecretValues } from '~/ui/hooks/use-organization-features';
import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';

export const useEditorRefresh = (callback: () => void) => {
  const { settings } = useRootLoaderData()!;
  const { showVariableSourceAndValue, nunjucksPowerUserMode } = settings;
  // Effective value (user setting OR organization enforcement), so editors also refresh when
  // the organization's enforcement changes or the user switches organization.
  const { hideSecretValues: hideSecretValuesInPreviewAndConsole } = useHideSecretValues();
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
