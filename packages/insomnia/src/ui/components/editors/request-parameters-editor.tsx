import type { RequestParameter } from 'insomnia-data';
import { type FC, useCallback } from 'react';

import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';

import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  // Any request flavour that owns a parameter list; the editor stays controlled
  // and does not care which document type it belongs to.
  request: { _id: string; parameters: RequestParameter[] };
  onChange: (patch: { parameters: RequestParameter[] }) => void;
  bulk: boolean;
  disabled?: boolean;
  onDescriptionToggle?: () => void;
}

export const RequestParametersEditor: FC<Props> = ({
  request,
  onChange,
  bulk,
  disabled = false,
  onDescriptionToggle,
}) => {
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
      onChange({ parameters });
    },
    [onChange],
  );

  let paramsString = '';
  for (const param of request.parameters) {
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
      onChange({ parameters });
    },
    [onChange],
  );

  if (bulk) {
    return (
      <CodeEditor
        id="request-parameters-editor"
        historyKey={`request-parameters-editor::${request._id}`}
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
      alwaysShowBlankRow
      allowMultiline
      namePlaceholder="name"
      valuePlaceholder="value"
      descriptionPlaceholder="description"
      pairs={request.parameters}
      onChange={pairs => onChangeParameter(pairs as RequestParameter[])}
      isDisabled={disabled}
      onDescriptionToggle={onDescriptionToggle}
    />
  );
};
