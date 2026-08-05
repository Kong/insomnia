import type { Environment, EnvironmentKvPairData } from 'insomnia-data';
import { EnvironmentType } from 'insomnia-data';
import { useCallback } from 'react';

import { getKVPairFromData } from '~/common/utils/environment-utils';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { AskModal } from '~/ui/components/modals/ask-modal';

export function useToggleEnvironmentType() {
  const toggleEnvironmentType = useCallback(
    (
      isSelected: boolean,
      environment: Pick<Environment, 'data' | 'dataPropertyOrder' | 'kvPairData'>,
      isValidJSON: boolean,
      updateEnvironmentTypeRequest: (type: EnvironmentType, kvPairData: EnvironmentKvPairData[]) => void,
    ) => {
      const newEnvironmentType = isSelected ? EnvironmentType.JSON : EnvironmentType.KVPAIR;
      // clear kvPairData when switch to json view, otherwise convert json data to kvPairData
      const kvPairData = isSelected ? [] : getKVPairFromData(environment.data, environment.dataPropertyOrder ?? null);
      const foundDisabledItem = isSelected && environment.kvPairData?.some(pair => !pair.enabled);
      const foundDuplicateNameItem =
        isSelected &&
        environment.kvPairData?.some((pair, idx) =>
          environment.kvPairData
            ?.slice(idx + 1)
            .some(newPair => pair.name.trim() === newPair.name.trim() && newPair.enabled),
        );
      if (!isValidJSON && newEnvironmentType === EnvironmentType.KVPAIR) {
        showModal(AlertModal, {
          title: 'Error',
          message: 'Please modify and fix the JSON string error before switch to Table view',
        });
      } else if (foundDisabledItem || foundDuplicateNameItem) {
        showModal(AskModal, {
          title: 'Change Environment Type',
          message: (
            <>
              {foundDisabledItem && <p>All disabled items will be lost.</p>}
              {foundDuplicateNameItem && <p>Items with same name will be lost except the last one.</p>}
              <p>Are you sure to continue?</p>
            </>
          ),
          onDone: async (saidYes: boolean) => {
            if (saidYes) {
              updateEnvironmentTypeRequest(newEnvironmentType, kvPairData);
            }
          },
        });
      } else {
        updateEnvironmentTypeRequest(newEnvironmentType, kvPairData);
      }
    },
    [],
  );
  return { toggleEnvironmentType };
}
