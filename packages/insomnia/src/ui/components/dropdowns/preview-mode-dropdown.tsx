import fs from 'fs';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { getPreviewModeName, PREVIEW_MODES, PreviewMode } from '../../../common/constants';
import { exportHarCurrentRequest } from '../../../common/har';
import * as models from '../../../models';
import { isRequest } from '../../../models/request';
import { isResponse } from '../../../models/response';
import { selectActiveRequest, selectActiveResponse, selectResponsePreviewMode } from '../../redux/selectors';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';

interface Props {
  download: (pretty: boolean) => any;
  copyToClipboard: () => any;
}

export const PreviewModeDropdown: FC<Props> = ({
  download,
  copyToClipboard,
}) => {
  const request = useSelector(selectActiveRequest);
  const previewMode = useSelector(selectResponsePreviewMode);
  const response = useSelector(selectActiveResponse);

  const handleClick = async (previewMode: PreviewMode) => {
    if (!request || !isRequest(request)) {
      return;
    }
    return models.requestMeta.updateOrCreateByParentId(request._id, { previewMode });
  };
  const handleDownloadPrettify = useCallback(() => download(true), [download]);

  const handleDownloadNormal = useCallback(() => download(false), [download]);

  const exportAsHAR = useCallback(async () => {
    if (!response || !request || !isRequest(request) || !isResponse(response)) {
      console.warn('Nothing to download');
      return;
    }

    const data = await exportHarCurrentRequest(request, response);
    const har = JSON.stringify(data, null, '\t');

    const { filePath } = await window.dialog.showSaveDialog({
      title: 'Export As HAR',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.har`,
    });

    if (!filePath) {
      return;
    }
    const to = fs.createWriteStream(filePath);
    to.on('error', err => {
      console.warn('Failed to export har', err);
    });
    to.end(har);
  }, [request, response]);

  const exportDebugFile = useCallback(async () => {
    if (!response || !request || !isResponse(response)) {
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
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.txt`,
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
  }, [request, response]);
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
