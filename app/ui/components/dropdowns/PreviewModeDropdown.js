import React, {PropTypes} from 'react';
import {Dropdown, DropdownDivider, DropdownButton, DropdownItem} from '../base/dropdown';
import {PREVIEW_MODES, getPreviewModeName} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';

const PreviewModeDropdown = ({updatePreviewMode, download, previewMode}) => (
  <Dropdown>
    <DropdownButton className="tall">
      <i className="fa fa-caret-down"></i>
    </DropdownButton>
    <DropdownDivider name="Preview Mode"/>
    {PREVIEW_MODES.map(mode => (
      <DropdownItem key={mode} onClick={() => {
        updatePreviewMode(mode);
        trackEvent('Response', 'Preview Mode Change', mode);
      }}>
        {previewMode === mode ? <i className="fa fa-check"/> : <i className="fa fa-empty"/>}
        {getPreviewModeName(mode)}
      </DropdownItem>
    ))}
    <DropdownDivider name="Response"/>
    <DropdownItem onClick={download}>
      <i className="fa fa-save"></i>
      Save to File
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
