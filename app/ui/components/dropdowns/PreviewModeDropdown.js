import React, {PropTypes} from 'react';
import Dropdown from '../base/Dropdown';
import DropdownDivider from '../base/DropdownDivider';
import {PREVIEW_MODES, getPreviewModeName} from '../../../backend/previewModes';

const PreviewModeDropdown = ({updatePreviewMode, download}) => (
  <Dropdown>
    <button className="tall">
      <i className="fa fa-caret-down"></i>
    </button>
    <ul>
      {PREVIEW_MODES.map(previewMode => (
        <li key={previewMode}>
          <button onClick={() => {
            updatePreviewMode(previewMode);
          }}>{getPreviewModeName(previewMode)}</button>
        </li>
      ))}
      <DropdownDivider></DropdownDivider>
      <li>
        <button onClick={download}>Download</button>
      </li>
    </ul>
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
