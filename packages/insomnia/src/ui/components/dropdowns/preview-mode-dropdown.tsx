import React, { FC } from 'react';

import { getPreviewModeName, PREVIEW_MODES } from '../../../common/constants';
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
  previewMode: string;
  showPrettifyOption?: boolean;
}

export const PreviewModeDropdown: FC<Props> = props => {
  const {
    fullDownload,
    previewMode,
    showPrettifyOption,
    exportAsHAR,
  } = props;

  const _handleClick = async (previewMode: string) => {
    await props.updatePreviewMode(previewMode);
  };
  const _handleDownloadPrettify =  () => props.download(true);

  const _handleDownloadNormal =  () => props.download(false);

  const _handleCopyRawResponse =  () => props.copyToClipboard();

  return <Dropdown beside>
    <DropdownButton className="tall">
      {getPreviewModeName(previewMode)}
      <i className="fa fa-caret-down space-left" />
    </DropdownButton>
    <DropdownDivider>Preview Mode</DropdownDivider>
    {PREVIEW_MODES.map(mode => <DropdownItem key={mode} onClick={_handleClick} value={mode}>
      {props.previewMode === mode ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}
      {getPreviewModeName(mode, true)}
    </DropdownItem>)}
    <DropdownDivider>Actions</DropdownDivider>
    <DropdownItem onClick={_handleCopyRawResponse}>
      <i className="fa fa-copy" />
      Copy raw response
    </DropdownItem>
    <DropdownItem onClick={_handleDownloadNormal}>
      <i className="fa fa-save" />
      Export raw response
    </DropdownItem>
    {showPrettifyOption && <DropdownItem onClick={_handleDownloadPrettify}>
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
