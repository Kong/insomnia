import fs from 'fs';
import { readFile } from 'fs/promises';
import React, { FC, useCallback } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { getPreviewModeName, PREVIEW_MODE_SOURCE, PREVIEW_MODES } from '../../../common/constants';
import { exportHarCurrentRequest } from '../../../common/har';
import * as models from '../../../models';
import { isRequest, Request } from '../../../models/request';
import { isResponse } from '../../../models/response';
import { CreateRequestType, useRequestMetaPatcher } from '../../hooks/use-request';
import { RequestLoaderData } from '../../routes/request';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';

interface Props {
  download: (pretty: boolean) => any;
  copyToClipboard: () => any;
}

export const PreviewModeDropdown: FC<Props> = ({
  download,
  copyToClipboard,
}) => {
  const { activeRequest, activeRequestMeta, activeResponse } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const previewMode = activeRequestMeta.previewMode || PREVIEW_MODE_SOURCE;
  const patchRequestMeta = useRequestMetaPatcher();
  const handleDownloadPrettify = useCallback(() => download(true), [download]);

  const handleDownloadNormal = useCallback(() => download(false), [download]);

  const exportAsHAR = useCallback(async () => {
    if (!activeResponse || !activeRequest || !isRequest(activeRequest) || !isResponse(activeResponse)) {
      console.warn('Nothing to download');
      return;
    }

    const data = await exportHarCurrentRequest(activeRequest, activeResponse);
    const har = JSON.stringify(data, null, '\t');

    const { filePath } = await window.dialog.showSaveDialog({
      title: 'Export As HAR',
      buttonLabel: 'Save',
      defaultPath: `${activeRequest.name.replace(/ +/g, '_')}-${Date.now()}.har`,
    });

    if (!filePath) {
      return;
    }
    const to = fs.createWriteStream(filePath);
    to.on('error', err => {
      console.warn('Failed to export har', err);
    });
    to.end(har);
  }, [activeRequest, activeResponse]);

  const exportDebugFile = useCallback(async () => {
    if (!activeResponse || !activeRequest || !isResponse(activeResponse)) {
      console.warn('Nothing to download');
      return;
    }

    const timeline = models.response.getTimeline(activeResponse);
    const headers = timeline
      .filter(v => v.name === 'HeaderIn')
      .map(v => v.value)
      .join('');

    const { canceled, filePath } = await window.dialog.showSaveDialog({
      title: 'Save Full Response',
      buttonLabel: 'Save',
      defaultPath: `${activeRequest.name.replace(/ +/g, '_')}-${Date.now()}.txt`,
    });

    if (canceled) {
      return;
    }
    const readStream = models.response.getBodyStream(activeResponse);

    if (readStream && filePath && typeof readStream !== 'string') {
      const to = fs.createWriteStream(filePath);
      to.write(headers);
      readStream.pipe(to);
      to.on('error', err => {
        console.warn('Failed to save full response', err);
      });
    }
  }, [activeRequest, activeResponse]);
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const createRequest = ({ requestType, parentId, req }: { requestType: CreateRequestType; parentId: string; req?: Partial<Request> }) =>
    requestFetcher.submit(JSON.stringify({ requestType, parentId, req }),
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
      });

  const mockResponse = async () => {
    if (!activeResponse) {
      return;
    }
    const { statusCode, statusMessage, headers, httpVersion, bytesContent, contentType } = activeResponse;
    const body = await readFile(activeResponse.bodyPath, 'utf8');
    // transform response to mockbin format
    const bin = await window.main.axiosRequest({
      url: 'http://mockbin.org/bin/create',
      method: 'post',
      data: {
        'status': statusCode,
        'statusText': statusMessage,
        'httpVersion': httpVersion,
        'headers': headers,
        // NOTE: cookies are sent as headers by insomnia
        'cookies': [],
        'content': {
          'size': bytesContent,
          'mimeType': contentType,
          'text': body,
        },
      },
    });
    // todo: record bin id in insomnia db
    // todo: list all bins
    // todo: show bin logs
    // todo: handle error
    if (bin?.data) {
      const id = bin.data;
      createRequest({
        requestType: 'HTTP',
        parentId: workspaceId,
        req: {
          ...activeRequest,
          name: 'Mock Response of ' + activeRequest.name,
          method: activeRequest.method,
          url: `https://mockbin.org/bin/${id}`,
        },
      });
    }
  };

  const shouldPrettifyOption = activeResponse?.contentType.includes('json');

  return (
    <Dropdown
      aria-label='Preview Mode Dropdown'
      triggerButton={
        <DropdownButton className="tall">
          {getPreviewModeName(previewMode)}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
      }
    >
      <DropdownSection
        aria-label='Preview Mode Section'
        title="Preview Mode"
      >
        {PREVIEW_MODES.map(mode =>
          <DropdownItem
            key={mode}
            aria-label={getPreviewModeName(mode, true)}
          >
            <ItemContent
              icon={previewMode === mode ? 'check' : 'empty'}
              label={getPreviewModeName(mode, true)}
              onClick={() => patchRequestMeta(activeRequest._id, { previewMode: mode })}
            />
          </DropdownItem>
        )}
      </DropdownSection>
      <DropdownSection
        aria-label='Action Section'
        title="Action"
      >
        <DropdownItem aria-label='Mock response'>
          <ItemContent
            icon="copy"
            label="Mock response"
            onClick={mockResponse}
          />
        </DropdownItem>
        <DropdownItem aria-label='Copy raw response'>
          <ItemContent
            icon="copy"
            label="Copy raw response"
            onClick={copyToClipboard}
          />
        </DropdownItem>
        <DropdownItem aria-label='Export raw response'>
          <ItemContent
            icon="save"
            label="Export raw response"
            onClick={handleDownloadNormal}
          />
        </DropdownItem>
        <DropdownItem aria-label='Export prettified response'>
          {shouldPrettifyOption &&
            <ItemContent
              icon="save"
              label="Export prettified response"
              onClick={handleDownloadPrettify}
            />
          }
        </DropdownItem>
        <DropdownItem aria-label='Export HTTP debug'>
          <ItemContent
            icon="bug"
            label="Export HTTP debug"
            onClick={exportDebugFile}
          />
        </DropdownItem>
        <DropdownItem aria-label='Export as HAR'>
          <ItemContent
            icon="save"
            label="Export as HAR"
            onClick={exportAsHAR}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
