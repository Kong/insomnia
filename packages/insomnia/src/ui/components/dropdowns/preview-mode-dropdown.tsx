import fs from 'fs';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouteLoaderData } from 'react-router-dom';

import { getPreviewModeName, PREVIEW_MODE_SOURCE, PREVIEW_MODES, PreviewMode } from '../../../common/constants';
import { exportHarCurrentRequest } from '../../../common/har';
import * as models from '../../../models';
import { isRequest, Request } from '../../../models/request';
import { RequestMeta } from '../../../models/request-meta';
import { isResponse } from '../../../models/response';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { selectActiveResponse } from '../../redux/selectors';
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
  const { activeRequest, activeRequestMeta } = useRouteLoaderData('request/:requestId') as RequestLoaderData<Request, RequestMeta>;
  const previewMode = activeRequestMeta.previewMode || PREVIEW_MODE_SOURCE;
  const response = useSelector(selectActiveResponse);
  const patchRequestMeta = useRequestMetaPatcher();
  const handleClick = async (previewMode: PreviewMode) => {
    patchRequestMeta(activeRequest._id, { previewMode });
  };
  const handleDownloadPrettify = useCallback(() => download(true), [download]);

  const handleDownloadNormal = useCallback(() => download(false), [download]);

  const exportAsHAR = useCallback(async () => {
    if (!response || !activeRequest || !isRequest(activeRequest) || !isResponse(response)) {
      console.warn('Nothing to download');
      return;
    }

    const data = await exportHarCurrentRequest(activeRequest, response);
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
  }, [activeRequest, response]);

  const exportDebugFile = useCallback(async () => {
    if (!response || !activeRequest || !isResponse(response)) {
      console.warn('Nothing to download');
      return;
    }

    const timeline = models.response.getTimeline(response);
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
    const readStream = models.response.getBodyStream(response);

    if (readStream && filePath && typeof readStream !== 'string') {
      const to = fs.createWriteStream(filePath);
      to.write(headers);
      readStream.pipe(to);
      to.on('error', err => {
        console.warn('Failed to save full response', err);
      });
    }
  }, [activeRequest, response]);
  const shouldPrettifyOption = response.contentType.includes('json');

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
              onClick={() => handleClick(mode)}
            />
          </DropdownItem>
        )}
      </DropdownSection>
      <DropdownSection
        aria-label='Action Section'
        title="Action"
      >
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
