import fs from 'fs';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { getPreviewModeName, PREVIEW_MODES, PreviewMode } from '../../../common/constants';
import { exportHarCurrentRequest } from '../../../common/har';
import * as models from '../../../models';
import { isRequest } from '../../../models/request';
import { isResponse } from '../../../models/response';
import { selectActiveRequest, selectActiveResponse, selectResponsePreviewMode } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';

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

    if (readStream && filePath) {
      const to = fs.createWriteStream(filePath);
      to.write(headers);
      readStream.pipe(to);
      to.on('error', err => {
        console.warn('Failed to save full response', err);
      });
    }
  }, [request, response]);
  const shouldPrettifyOption = response.contentType.includes('json');
  return <Dropdown beside>
    <DropdownButton className="tall">
      {getPreviewModeName(previewMode)}
      <i className="fa fa-caret-down space-left" />
    </DropdownButton>
    <DropdownDivider>Preview Mode</DropdownDivider>
    {PREVIEW_MODES.map(mode => <DropdownItem key={mode} onClick={() => handleClick(mode)}>
      {previewMode === mode ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}
      {getPreviewModeName(mode, true)}
    </DropdownItem>)}
    <DropdownDivider>Actions</DropdownDivider>
    <DropdownItem onClick={copyToClipboard}>
      <i className="fa fa-copy" />
      Copy raw response
    </DropdownItem>
    <DropdownItem onClick={handleDownloadNormal}>
      <i className="fa fa-save" />
      Export raw response
    </DropdownItem>
    {shouldPrettifyOption && <DropdownItem onClick={handleDownloadPrettify}>
      <i className="fa fa-save" />
      Export prettified response
    </DropdownItem>}
    <DropdownItem onClick={exportDebugFile}>
      <i className="fa fa-bug" />
      Export HTTP debug
    </DropdownItem>
    <DropdownItem onClick={exportAsHAR}>
      <i className="fa fa-save" />
      Export as HAR
    </DropdownItem>
  </Dropdown>;
};
