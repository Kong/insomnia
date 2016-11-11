import React, {PropTypes} from 'react';
import {Dropdown, DropdownDivider, DropdownButton, DropdownItem} from '../base/dropdown';
import {PREVIEW_MODES, getPreviewModeName} from '../../../common/constants';

const PreviewModeDropdown = ({updatePreviewMode, download}) => (
  <Dropdown>
    <DropdownButton className="tall">
      <i className="fa fa-caret-down"></i>
    </DropdownButton>
    {PREVIEW_MODES.map(previewMode => (
      <DropdownItem key={previewMode} onClick={() => updatePreviewMode(previewMode)}>
        {getPreviewModeName(previewMode)}
      </DropdownItem>
    ))}
    <DropdownDivider></DropdownDivider>
    <DropdownItem onClick={download}>
      Download
    </DropdownItem>
  </Dropdown>
);

PreviewModeDropdown.propTypes = {
  // Functions
  updatePreviewMode: PropTypes.func.isRequired,
  download: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired
};

export default PreviewModeDropdown;
