import React, { FC } from 'react';

import { getPreviewModeName, PREVIEW_MODES, PreviewMode } from '../../../common/constants';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';

interface Props {
  download: () => void;
  copyToClipboard: () => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
}

export const WebSocketPreviewModeDropdown: FC<Props> = ({
  download,
  copyToClipboard,
  previewMode,
  setPreviewMode,
}) => {
  return <Dropdown beside>
    <DropdownButton className="tall">
      {getPreviewModeName(previewMode)}
      <i className="fa fa-caret-down space-left" />
    </DropdownButton>
    <DropdownDivider>Preview Mode</DropdownDivider>
    {PREVIEW_MODES.map(mode => <DropdownItem key={mode} onClick={() => setPreviewMode(mode)}>
      {previewMode === mode ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}
      {getPreviewModeName(mode, true)}
    </DropdownItem>)}
    <DropdownDivider>Actions</DropdownDivider>
    <DropdownItem onClick={copyToClipboard}>
      <i className="fa fa-copy" />
      Copy raw response
    </DropdownItem>
    <DropdownItem onClick={download}>
      <i className="fa fa-save" />
      Export raw response
    </DropdownItem>
  </Dropdown>;
};
