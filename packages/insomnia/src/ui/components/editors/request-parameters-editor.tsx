import { type FC, useCallback } from 'react';
import { useParams } from 'react-router';

import type { RequestParameter } from '~/models/request';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';
import { useRequestPatcher } from '~/ui/hooks/use-request';

import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  bulk: boolean;
  disabled?: boolean;
}

export const RequestParametersEditor: FC<Props> = ({ bulk, disabled = false }) => {
  const { requestId } = useParams() as { requestId: string };
  const { activeRequest } = useRequestLoaderData() as RequestLoaderData;
  const patchRequest = useRequestPatcher();
  const handleBulkUpdate = useCallback(
    (paramsString: string) => {
      const parameters: {
        name: string;
        value: string;
      }[] = [];

      const rows = paramsString.split(/\n+/);
      for (const row of rows) {
        const [rawName, rawValue] = row.split(/:(.*)$/);
        const name = (rawName || '').trim();
        const value = (rawValue || '').trim();

        if (!name && !value) {
          continue;
        }

        parameters.push({
          name,
          value,
        });
      }
      patchRequest(requestId, { parameters });
    },
    [patchRequest, requestId],
  );

  let paramsString = '';
  for (const param of activeRequest.parameters) {
    // Make sure it's not disabled
    if (param.disabled) {
      continue;
    }
    // Make sure it's not blank
    if (!param.name && !param.value) {
      continue;
    }

    paramsString += `${param.name}: ${param.value}\n`;
  }

  const onChangeParameter = useCallback(
    (parameters: RequestParameter[]) => {
      patchRequest(requestId, { parameters });
    },
    [patchRequest, requestId],
  );

  if (bulk) {
    return (
      <CodeEditor
        id="request-parameters-editor"
        className="flex-1"
        onChange={handleBulkUpdate}
        defaultValue={paramsString}
        enableNunjucks
        readOnly={disabled}
      />
    );
  }

  return (
    <KeyValueEditor
      allowMultiline
      namePlaceholder="name"
      valuePlaceholder="value"
      descriptionPlaceholder="description"
      pairs={activeRequest.parameters}
      onChange={pairs => onChangeParameter(pairs as RequestParameter[])}
      isDisabled={disabled}
    />
  );
};
