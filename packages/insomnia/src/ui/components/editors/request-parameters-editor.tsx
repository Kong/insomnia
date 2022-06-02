import React, { FC } from 'react';

import type { Request, RequestParameter } from '../../../models/request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  onChange: (r: Request, parameters: RequestParameter[]) => Promise<Request>;
  bulk: boolean;
  request: Request;
}

export const RequestParametersEditor: FC<Props> = props => {
  const _handleBulkUpdate = (paramsString: string) => {
    const {
      onChange,
      request,
    } = props;
    const params: {
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

      params.push({
        name,
        value,
      });
    }

    onChange(request, params);
  };

  const _getQueriesString = () => {
    const {
      parameters,
    } = props.request;
    let paramsString = '';

    for (const param of parameters) {
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

    return paramsString;
  };

  const {
    bulk,
    request,
  } = props;
  return bulk ?
    <CodeEditor onChange={_handleBulkUpdate} defaultValue={_getQueriesString()} enableNunjucks /> :
    <KeyValueEditor sortable allowMultiline namePlaceholder="name" valuePlaceholder="value" descriptionPlaceholder="description" pairs={request.parameters} onChange={parameters => props.onChange(props.request, parameters)} />;
};
