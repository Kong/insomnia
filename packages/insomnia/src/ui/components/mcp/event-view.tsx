import fs from 'node:fs';

import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import React, { useCallback, useRef } from 'react';
import { Button } from 'react-aria-components';
import { useParams } from 'react-router';

import {
  getPreviewModeName,
  PREVIEW_MODE_FRIENDLY,
  PREVIEW_MODE_RAW,
  PREVIEW_MODE_SOURCE,
  PREVIEW_MODES,
} from '../../../common/constants';
import { METHOD_CALL_TOOL } from '../../../common/mcp-utils';
import type { McpEvent } from '../../../main/network/mcp';
import { useRequestLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { CodeEditor, type CodeEditorHandle } from '../../components/.client/codemirror/code-editor';
import { showError } from '../../components/modals';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';

interface Props {
  event: McpEvent;
}

export const MessageEventView = ({ event }: Props) => {
  const { requestId } = useParams() as { requestId: string };
  const editorRef = useRef<CodeEditorHandle>(null);

  const isErrorEvent = event.type === 'error';
  const isCallToolEvent = event.type === 'message' && event.method === METHOD_CALL_TOOL;
  const eventData = isErrorEvent ? event.error : 'data' in event ? event.data : '';
  const raw = JSON.stringify(eventData);

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
    // If call tool response, try to parse the `result.content` field if it's JSON string
    if (isCallToolEvent && 'result' in parsed) {
      const callToolResult = parsed.result;
      if ('content' in callToolResult) {
        const callToolParsedResult = CallToolResultSchema.safeParse(callToolResult);
        if (callToolParsedResult.success) {
          const callToolResultContents = callToolParsedResult.data.content;
          callToolResultContents.forEach((callToolResultContent, idx) => {
            if (callToolResultContent.type === 'text') {
              const callToolResultContentText = callToolResultContent.text;
              // Try to parse JSON text content
              try {
                const callToolResultContentTextParsed = JSON.parse(callToolResultContentText);
                callToolResultContent.text = callToolResultContentTextParsed;
              } catch (err) {}
            }
            parsed.result.content[idx] = callToolResultContent;
          });
        }
      }
    }
    // Escape tabs and new lines for CodeMirror display
    pretty = JSON.stringify(parsed, null, '\t')
      .replace(/\\n|\\r\\n|\\r/g, '\n')
      .replace(/\\t/g, '\t');
  } catch {
    // Can't parse as JSON.
  }
  const { activeRequestMeta } = useRequestLoaderData()!;
  const previewMode = ('previewMode' in activeRequestMeta && activeRequestMeta.previewMode) || PREVIEW_MODE_SOURCE;
  return (
    <div className="flex h-full flex-col">
      <div className="box-border flex h-8 flex-row border-b border-gray-300 p-2">
        <Dropdown
          aria-label="Websocket Preview Mode Dropdown"
          triggerButton={
            <Button className="tall">
              {getPreviewModeName(previewMode)}
              <i className="fa fa-caret-down space-left" />
            </Button>
          }
        >
          <DropdownSection aria-label="Preview Mode Section" title="Preview Mode">
            {PREVIEW_MODES.map(mode => (
              <DropdownItem aria-label={getPreviewModeName(mode, true)} key={mode}>
                <ItemContent
                  icon={previewMode === mode ? 'check' : 'empty'}
                  label={getPreviewModeName(mode, true)}
                  onClick={() => {
                    patchRequestMeta(requestId, { previewMode: mode });
                    editorRef.current?.setValue(mode === PREVIEW_MODE_FRIENDLY ? pretty : raw);
                  }}
                />
              </DropdownItem>
            ))}
          </DropdownSection>
          <DropdownSection aria-label="Actions Section" title="Actions">
            <DropdownItem aria-label="Copy raw response">
              <ItemContent icon="copy" label="Copy raw response" onClick={handleCopyResponseToClipboard} />
            </DropdownItem>
            <DropdownItem aria-label="Export raw response">
              <ItemContent icon="save" label="Export raw response" onClick={handleDownloadResponseBody} />
            </DropdownItem>
          </DropdownSection>
        </Dropdown>
      </div>
      <div className="flex-grow p-4">
        <CodeEditor
          id="mcp-data-preview"
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

export const McpEventView = ({ event }: Props) => {
  if (event.type === 'message' || event.type === 'notification' || event.type === 'error') {
    return <MessageEventView event={event} />;
  }
  return null;
};
