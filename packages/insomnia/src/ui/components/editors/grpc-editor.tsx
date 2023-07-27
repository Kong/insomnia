import React, { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models';
import type { Response } from '../../../models/response';
import { useRequestMetaUpdateFetcher } from '../../hooks/create-request';
import { selectActiveResponse } from '../../redux/selectors';
import { CodeEditor } from '../codemirror/code-editor';

interface Props {
  content?: string;
  handleChange?: (arg0: string) => void;
  readOnly?: boolean;
}

export const GRPCEditor: FunctionComponent<Props> = ({
  content,
  handleChange,
  readOnly,
}) => {
  const response = useSelector(selectActiveResponse) as Response | null;
  const updateRequestMetaByParentId = useRequestMetaUpdateFetcher();
  const handleSetFilter = async (responseFilter: string) => {
    if (!response) {
      return;
    }
    const requestId = response.parentId;
    await updateRequestMetaByParentId(requestId, { responseFilter });
    const meta = await models.requestMeta.getByParentId(requestId);
    if (!meta) {
      return;
    }
    const responseFilterHistory = meta.responseFilterHistory.slice(0, 10);
    // Already in history or empty?
    if (!responseFilter || responseFilterHistory.includes(responseFilter)) {
      return;
    }
    responseFilterHistory.unshift(responseFilter);
    updateRequestMetaByParentId(requestId, { responseFilterHistory });
  };
  return (<CodeEditor
    defaultValue={content}
    onChange={handleChange}
    mode="application/json"
    enableNunjucks
    readOnly={readOnly}
    autoPrettify={readOnly}
    showPrettifyButton={!readOnly}
    updateFilter={handleSetFilter}
  />);
};
