import { models, services } from 'insomnia-data';
import { getPreviewModeName, PREVIEW_MODE_SOURCE, PREVIEW_MODES } from 'insomnia-data/common';
import React, { type FC, useCallback } from 'react';
import { Button } from 'react-aria-components';

import { LARGE_RESPONSE_MB } from '~/common/constants';
import { bodyBufferToUtf8 } from '~/common/utils/utf8-bytes';

import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { showError } from '../modals';

interface Props {
  download: (pretty: boolean) => any;
  copyToClipboard: () => any;
}

export const PreviewModeDropdown: FC<Props> = ({ download, copyToClipboard }) => {
  const { activeRequest, activeRequestMeta, activeResponse } = useRequestLoaderData() as RequestLoaderData;
  const previewMode = activeRequestMeta.previewMode || PREVIEW_MODE_SOURCE;
  const patchRequestMeta = useRequestMetaPatcher();
  const handleDownloadPrettify = useCallback(() => download(true), [download]);

  const handleDownloadNormal = useCallback(() => download(false), [download]);

  const exportAsHAR = useCallback(async () => {
    if (
      !activeResponse ||
      !activeRequest ||
      !models.request.isRequest(activeRequest) ||
      !models.response.isResponse(activeResponse)
    ) {
      console.warn('Nothing to download');
      return;
    }

    try {
      const data = await window.main.exportHarCurrentRequest({
        requestId: activeRequest._id,
        responseId: activeResponse._id,
      });
      const har = JSON.stringify(data, null, '\t');

      const { filePath } = await window.dialog.showSaveDialog({
        title: 'Export As HAR',
        buttonLabel: 'Save',
        defaultPath: `${activeRequest.name.replace(/ +/g, '_')}-${Date.now()}.har`,
      });

      if (!filePath) {
        return;
      }

      await window.main.writeFile({
        path: filePath,
        content: har,
      });
    } catch (err) {
      showError({
        title: 'Failed to export as HAR',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [activeRequest, activeResponse]);

  const exportDebugFile = useCallback(async () => {
    if (!activeResponse || !activeRequest || !models.response.isResponse(activeResponse)) {
      console.warn('Nothing to download');
      return;
    }

    try {
      const timeline = await services.helpers.getResponseTimeline(activeResponse);
      const headers = timeline
        .filter(v => v.name === 'HeaderIn')
        .map(v => v.value)
        .join('');

      const { canceled, filePath } = await window.dialog.showSaveDialog({
        title: 'Save Full Response',
        buttonLabel: 'Save',
        defaultPath: `${activeRequest.name.replace(/ +/g, '_')}-${Date.now()}.txt`,
      });

      if (canceled || !filePath || !activeResponse.bodyBuffer) {
        return;
      }

      await window.main.writeFile({
        path: filePath,
        content: headers + '\n' + bodyBufferToUtf8(activeResponse.bodyBuffer) || '',
      });
    } catch (err) {
      showError({
        title: 'Failed to export HTTP debug',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [activeRequest, activeResponse]);
  const shouldPrettifyOption = activeResponse?.contentType.includes('json');
  // Prettifying and the debug export both need the whole body as a string in renderer memory, so
  // they stay bounded. The raw export has no such limit: it streams from disk in the main process.
  const isLargeResponse = activeResponse
    ? Math.max(activeResponse.bytesContent ?? 0, activeResponse.bytesRead ?? 0) > LARGE_RESPONSE_MB * 1024 * 1024
    : false;

  return (
    <Dropdown
      aria-label="Preview Mode Dropdown"
      triggerButton={
        <Button className="text-(--hl)">
          {getPreviewModeName(previewMode)}
          <i className="fa fa-caret-down space-left" />
        </Button>
      }
    >
      <DropdownSection aria-label="Preview Mode Section" title="Preview Mode">
        {PREVIEW_MODES.map(mode => (
          <DropdownItem key={mode} aria-label={getPreviewModeName(mode, true)}>
            <ItemContent
              icon={previewMode === mode ? 'check' : 'empty'}
              label={getPreviewModeName(mode, true)}
              onClick={() => patchRequestMeta(activeRequest._id, { previewMode: mode })}
            />
          </DropdownItem>
        ))}
      </DropdownSection>
      <DropdownSection aria-label="Action Section" title="Action">
        <DropdownItem aria-label="Copy raw response">
          <ItemContent icon="copy" label="Copy raw response" onClick={copyToClipboard} />
        </DropdownItem>
        <DropdownItem aria-label="Export raw response">
          <ItemContent icon="save" label="Export raw response" onClick={handleDownloadNormal} />
        </DropdownItem>
        <DropdownItem aria-label="Export prettified response">
          {shouldPrettifyOption && (
            <ItemContent
              icon="save"
              label={
                isLargeResponse ? `Export prettified response (must be <${LARGE_RESPONSE_MB}MB)` : 'Export prettified response'
              }
              isDisabled={isLargeResponse}
              className={isLargeResponse ? 'opacity-50' : ''}
              onClick={handleDownloadPrettify}
            />
          )}
        </DropdownItem>
        <DropdownItem aria-label="Export HTTP debug">
          <ItemContent
            icon="bug"
            label={isLargeResponse ? `Export HTTP debug (must be <${LARGE_RESPONSE_MB}MB)` : 'Export HTTP debug'}
            isDisabled={isLargeResponse}
            className={isLargeResponse ? 'opacity-50' : ''}
            onClick={exportDebugFile}
          />
        </DropdownItem>
        <DropdownItem aria-label="Export as HAR">
          <ItemContent icon="save" label="Export as HAR" onClick={exportAsHAR} />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
