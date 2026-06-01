import React, { type FC, useCallback, useRef } from 'react';
import { useParams } from 'react-router';

import { PREVIEW_MODE_FRIENDLY, PREVIEW_MODE_RAW, PREVIEW_MODE_SOURCE } from '~/insomnia-data/common';
import { CodeEditor, type CodeEditorHandle } from '~/ui/components/.client/codemirror/code-editor';

import type { CurlEvent, CurlMessageEvent } from '../../../main/network/curl';
import type { SocketIOEvent } from '../../../main/network/socket-io';
import type { WebSocketEvent, WebSocketMessageEvent } from '../../../main/network/websocket';
import { useRequestLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { WebSocketPreviewModeDropdown } from './websocket-preview-dropdown';

interface Props<T> {
  event: T;
}

export const MessageEventView: FC<Props<CurlMessageEvent | WebSocketMessageEvent>> = ({ event }) => {
  const { requestId } = useParams() as { requestId: string };
  const editorRef = useRef<CodeEditorHandle>(null);

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
    await window.main.writeFile({
      path: outputPath,
      content: raw,
    });
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
  const { activeRequestMeta } = useRequestLoaderData()!;
  const previewMode = ('previewMode' in activeRequestMeta && activeRequestMeta.previewMode) || PREVIEW_MODE_SOURCE;
  return (
    <div className="flex h-full flex-col">
      <div className="box-border flex h-8 items-center border-b border-(--hl-sm) p-2">
        <WebSocketPreviewModeDropdown
          download={handleDownloadResponseBody}
          copyToClipboard={handleCopyResponseToClipboard}
          previewMode={previewMode}
          setPreviewMode={previewMode => {
            patchRequestMeta(requestId, { previewMode });
            editorRef.current?.setValue(previewMode === PREVIEW_MODE_FRIENDLY ? pretty : raw);
          }}
        />
      </div>
      <div className="grow p-4">
        <CodeEditor
          id="websocket-body-preview"
          hideLineNumbers
          mode={previewMode === PREVIEW_MODE_RAW ? 'text/plain' : 'text/json'}
          defaultValue={previewMode === PREVIEW_MODE_FRIENDLY ? pretty : raw}
          uniquenessKey={event._id}
          ref={editorRef}
          readOnly
        />
      </div>
    </div>
  );
};

export const EventView: FC<Props<CurlEvent | WebSocketEvent | SocketIOEvent>> = ({ event }) => {
  if (event.type === 'message') {
    return <MessageEventView event={event} />;
  }
  return null;
};
