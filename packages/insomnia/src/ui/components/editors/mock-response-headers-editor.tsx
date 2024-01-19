import React, { FC, useCallback } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { MockRoute } from '../../../models/mock-route';
import type { RequestHeader } from '../../../models/request';
import { MockRouteLoaderData } from '../../routes/mock-route';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  bulk: boolean;
  isDisabled?: boolean;
  onBlur?: (e: FocusEvent) => void;
}
export const useMockRoutePatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const fetcher = useFetcher();
  return (id: string, patch: Partial<MockRoute>) => {
    fetcher.submit(JSON.stringify(patch), {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/${id}/update`,
      method: 'post',
      encType: 'application/json',
    });
  };
};
export const MockResponseHeadersEditor: FC<Props> = ({
  bulk,
  isDisabled,
  onBlur,
}) => {
  const { mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const patchMockRoute = useMockRoutePatcher();

  const { mockRouteId } = useParams() as { mockRouteId: string };

  const handleBulkUpdate = useCallback((headersString: string) => {
    const headers: {
      name: string;
      value: string;
    }[] = [];

    const rows = headersString.split(/\n+/);
    for (const row of rows) {
      const [rawName, rawValue] = row.split(/:(.*)$/);
      const name = (rawName || '').trim();
      const value = (rawValue || '').trim();

      if (!name && !value) {
        continue;
      }

      headers.push({
        name,
        value,
      });
    }
    patchMockRoute(mockRouteId, { headers });
  }, [patchMockRoute, mockRouteId]);

  let headersString = '';
  for (const header of mockRoute.headers) {
    // Make sure it's not disabled
    if (header.disabled) {
      continue;
    }
    // Make sure it's not blank
    if (!header.name && !header.value) {
      continue;
    }

    headersString += `${header.name}: ${header.value}\n`;
  }

  const onChangeHeaders = useCallback((headers: RequestHeader[]) => {
    patchMockRoute(mockRouteId, { headers });
  }, [patchMockRoute, mockRouteId]);

  if (bulk) {
    return (
      <div className="tall">
        <CodeEditor
          id="request-headers-editor"
          onChange={handleBulkUpdate}
          defaultValue={headersString}
          enableNunjucks
          onBlur={onBlur}
        />
      </div>
    );
  }

  return (
    <KeyValueEditor
      namePlaceholder="header"
      valuePlaceholder="value"
      descriptionPlaceholder="description"
      pairs={mockRoute.headers}
      handleGetAutocompleteNameConstants={getCommonHeaderNames}
      handleGetAutocompleteValueConstants={getCommonHeaderValues}
      onChange={onChangeHeaders}
      isDisabled={isDisabled}
      onBlur={onBlur}
    />
  );
};
