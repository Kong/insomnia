import fs from 'fs';
import React, { type FC, useCallback } from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import { PREVIEW_MODE_FRIENDLY, PREVIEW_MODE_RAW, PREVIEW_MODE_SOURCE } from '../../../common/constants';
import type { CurlEvent, CurlMessageEvent } from '../../../main/network/curl';
import type { WebSocketEvent, WebSocketMessageEvent } from '../../../main/network/websocket';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import type { RequestLoaderData } from '../../routes/request';
import { CodeEditor } from '../codemirror/code-editor';
import { showError } from '../modals';
import { WebSocketPreviewModeDropdown } from './websocket-preview-dropdown';

interface Props<T extends WebSocketEvent> {
  event: T;
}

export const MessageEventView: FC<Props<CurlMessageEvent | WebSocketMessageEvent>> = ({ event }) => {
  const { requestId } = useParams() as { requestId: string };
  let raw = event.data.toString();
  // Best effort to parse the binary data as a string
  try {
    if ('data' in event && typeof event.data === 'object' && 'data' in event.data && Array.isArray(event.data.data)) {
      raw = Buffer.from(event.data.data).toString();
    }
  } catch (err) {
    console.error('Failed to parse event data to string, defaulting to JSON.stringify', err);
    raw = JSON.stringify(event.data);
  }

  const handleDownloadResponseBody = useCallback(async () => {
    const { canceled, filePath: outputPath } = await window.dialog.showSaveDialog({
      title: 'Save Response Body',
      buttonLabel: 'Save',
    });

    if (canceled || !outputPath) {
      return;
    }

    const to = fs.createWriteStream(outputPath);

    to.on('error', err => {
      showError({
        title: 'Save Failed',
        message: 'Failed to save response body',
        error: err,
      });
    });

    to.write(raw);

    to.end();
  }, [raw]);

  const handleCopyResponseToClipboard = useCallback(() => {
    window.clipboard.writeText(raw);
  }, [raw]);

  const patchRequestMeta = useRequestMetaPatcher();

  let pretty = raw;
  try {
    const parsed = JSON.parse(raw);
    pretty = JSON.stringify(parsed, null, '\t');
  } catch {
    // Can't parse as JSON.
  }
  const { activeRequestMeta } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const previewMode = activeRequestMeta.previewMode || PREVIEW_MODE_SOURCE;
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row box-border h-8 border-b border-gray-300 p-2">
        <WebSocketPreviewModeDropdown
          download={handleDownloadResponseBody}
          copyToClipboard={handleCopyResponseToClipboard}
          previewMode={previewMode}
          setPreviewMode={previewMode => patchRequestMeta(requestId, { previewMode })}
        />
      </div>
      <div className="flex-grow p-4">
        <CodeEditor
          id="websocket-body-preview"
          hideLineNumbers
          mode={previewMode === PREVIEW_MODE_RAW ? 'text/plain' : 'text/json'}
          defaultValue={previewMode === PREVIEW_MODE_FRIENDLY ? pretty : raw}
          uniquenessKey={event._id}
          readOnly
        />
      </div>
    </div>
  );
};

export const EventView: FC<Props<CurlEvent | WebSocketEvent>> = ({ event }) => {
  if (event.type === 'message') {
    return <MessageEventView event={event} />;
  }
  return null;
};
