import {
  CallToolResultSchema,
  CreateMessageRequestSchema,
  ElicitRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { type RJSFSchema } from '@rjsf/utils';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import type { McpEvent } from '../../../main/mcp/types';
import * as models from '../../../models';
import {
  type McpRequestLoaderData,
  useRequestLoaderData,
} from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { CodeEditor, type CodeEditorHandle } from '../../components/.client/codemirror/code-editor';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { ElicitationForm } from './elicitation-form';
import { SamplingForm } from './sampling-form';

interface Props {
  event: McpEvent;
}

export const MessageEventView = ({ event }: Props) => {
  const { activeRequestMeta, activeResponse } = useRequestLoaderData() as McpRequestLoaderData;
  const filterHistory = activeRequestMeta.responseFilterHistory || [];
  const filter = activeRequestMeta.responseFilter || '';
  const [isServerRequestResponded, setIsServerRequestResponded] = useState(true);
  const editorRef = useRef<CodeEditorHandle>(null);
  const { requestId } = useParams() as { requestId: string };

  const isErrorEvent = event.type === 'error';
  const isCallToolEvent = event.type === 'message' && event.method === METHOD_CALL_TOOL;
  const eventData = isErrorEvent ? event.error : 'data' in event ? event.data : '';
  const raw = JSON.stringify(eventData);
  const isElicitationRequest = ElicitRequestSchema.safeParse(eventData).success;
  const samplingRequestParseResult = CreateMessageRequestSchema.safeParse(eventData);
  const isSamplingRequest = samplingRequestParseResult.success;
  const [viewMode, setViewMode] = useState<'raw' | 'form'>('raw');

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

  const handleSetFilter = async (responseFilter: string) => {
    if (!activeResponse) {
      return;
    }
    const requestId = activeResponse.parentId;
    await patchRequestMeta(requestId, { responseFilter });
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
    patchRequestMeta(requestId, { responseFilterHistory });
  };

  const getElicitationFormSchema = () => {
    if (ElicitRequestSchema.safeParse(eventData).success) {
      const parsedElicitRequest = ElicitRequestSchema.parse(eventData);
      if ('requestedSchema' in parsedElicitRequest.params) {
        const requestSchema = parsedElicitRequest.params.requestedSchema;
        return requestSchema as RJSFSchema;
      }
    }
    return {};
  };

  let pretty = raw;
  try {
    const parsed = JSON.parse(raw, (_key, value) => {
      // Try to parse any nested JSON strings
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    });
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
              } catch {}
            }
            parsed.result.content[idx] = callToolResultContent;
          });
        }
      }
    }
    pretty = JSON.stringify(parsed, null, '\t');
  } catch {
    // Can't parse as JSON.
  }
  const previewMode = ('previewMode' in activeRequestMeta && activeRequestMeta.previewMode) || PREVIEW_MODE_SOURCE;

  useEffect(() => {
    const checkRequestCompleted = async () => {
      // check if the server request has been responded
      const hasRequestResponded = await window.main.mcp.client.hasRequestResponded({
        requestId,
        serverRequestId: eventData?.id,
      });
      if (hasRequestResponded) {
        setIsServerRequestResponded(true);
        setViewMode('raw');
      } else {
        setIsServerRequestResponded(false);
        setViewMode('form');
      }
    };
    if (isElicitationRequest || isSamplingRequest) {
      checkRequestCompleted();
    }
  }, [requestId, eventData?.id, isElicitationRequest, isSamplingRequest]);

  return (
    <div className="flex h-full flex-col">
      <div className="box-border flex h-8 flex-row items-center border-b border-(--hl-md)">
        <Dropdown
          aria-label="Websocket Preview Mode Dropdown"
          className="p-2"
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
                    setViewMode('raw');
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
        {!isServerRequestResponded && (
          <Button
            className={`px-2 text-(--color-font) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) ${
              viewMode === 'form' ? 'bg-(--hl-xs) text-(--color-font)' : ''
            }`}
            onPress={() => setViewMode('form')}
          >
            {isElicitationRequest ? 'Elicitation Form' : 'Sampling Form'}
          </Button>
        )}
      </div>
      {viewMode === 'raw' && (
        <div className="h-full grow">
          <CodeEditor
            id="mcp-data-preview"
            hideLineNumbers
            mode={previewMode === PREVIEW_MODE_RAW ? 'text/plain' : 'text/json'}
            defaultValue={previewMode === PREVIEW_MODE_FRIENDLY ? pretty : raw}
            uniquenessKey={event._id}
            ref={editorRef}
            filter={filter}
            updateFilter={handleSetFilter}
            filterHistory={filterHistory}
            readOnly
            autoPrettify
          />
        </div>
      )}
      {viewMode === 'form' && isElicitationRequest && (
        <ElicitationForm schema={getElicitationFormSchema()} requestId={requestId} serverRequestId={eventData?.id} />
      )}
      {viewMode === 'form' && isSamplingRequest && (
        <SamplingForm
          requestId={requestId}
          serverRequestId={eventData?.id}
          samplingData={samplingRequestParseResult.data}
        />
      )}
    </div>
  );
};

export const McpEventView = ({ event }: Props) => {
  if (event.type === 'message' || event.type === 'notification' || event.type === 'error') {
    return <MessageEventView event={event} />;
  }
  return null;
};
