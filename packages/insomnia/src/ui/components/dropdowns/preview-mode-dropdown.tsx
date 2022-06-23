import React, { FC, useCallback } from 'react';

import { getPreviewModeName, PREVIEW_MODES, PreviewMode } from '../../../common/constants';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';

interface Props {
  download: (pretty: boolean) => any;
  fullDownload: (pretty: boolean) => any;
  exportAsHAR: () => void;
  copyToClipboard: () => any;
  updatePreviewMode: Function;
  previewMode: PreviewMode;
  showPrettifyOption?: boolean;
}

export const PreviewModeDropdown: FC<Props> = ({
  fullDownload,
  previewMode,
  showPrettifyOption,
  download,
  copyToClipboard,
  exportAsHAR,
  updatePreviewMode,
}) => {

  const handleClick = async (previewMode: string) => {
    await updatePreviewMode(previewMode);
  };
  const handleDownloadPrettify = useCallback(() => {
    download(true);
  }, [download]);

  const handleDownloadNormal = useCallback(() => {
    download(false);
  }, [download]);

  const handleCopyRawResponse = useCallback(() => {
    copyToClipboard();
  }, [copyToClipboard]);

  return <Dropdown beside>
    <DropdownButton className="tall">
      {getPreviewModeName(previewMode)}
      <i className="fa fa-caret-down space-left" />
    </DropdownButton>
    <DropdownDivider>Preview Mode</DropdownDivider>
    {PREVIEW_MODES.map(mode => <DropdownItem key={mode} onClick={handleClick} value={mode}>
      {previewMode === mode ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}
      {getPreviewModeName(mode, true)}
    </DropdownItem>)}
    <DropdownDivider>Actions</DropdownDivider>
    <DropdownItem onClick={handleCopyRawResponse}>
      <i className="fa fa-copy" />
      Copy raw response
    </DropdownItem>
    <DropdownItem onClick={handleDownloadNormal}>
      <i className="fa fa-save" />
      Export raw response
    </DropdownItem>
    {showPrettifyOption && <DropdownItem onClick={handleDownloadPrettify}>
      <i className="fa fa-save" />
      Export prettified response
    </DropdownItem>}
    <DropdownItem onClick={fullDownload}>
      <i className="fa fa-bug" />
      Export HTTP debug
    </DropdownItem>
    <DropdownItem onClick={exportAsHAR}>
      <i className="fa fa-save" />
      Export as HAR
    </DropdownItem>
  </Dropdown>;
};
