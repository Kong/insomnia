import React, {PropTypes} from 'react';

import Dropdown from '../base/Dropdown';
import DropdownDivider from '../base/DropdownDivider';
import {PREVIEW_MODES, getPreviewModeName} from '../../lib/previewModes';
import {trackEvent} from '../../lib/analytics';

const PreviewModeDropdown = ({updatePreviewMode, downloadResponse}) => {
  return (
    <Dropdown>
      <button className="tall">
        <i className="fa fa-caret-down"></i>
      </button>
      <ul>
        {PREVIEW_MODES.map(previewMode => (
          <li key={previewMode}>
            <button onClick={() => {
              trackEvent('Changed Preview Mode', {previewMode});
              updatePreviewMode(previewMode);
            }}>{getPreviewModeName(previewMode)}</button>
          </li>
        ))}
        <DropdownDivider/>
        <li>
          <button onClick={() => downloadResponse()}>
            Download
          </button>
        </li>
      </ul>
    </Dropdown>
  )
};

PreviewModeDropdown.propTypes = {
  // Functions
  updatePreviewMode: PropTypes.func.isRequired,
  downloadResponse: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired
};

export default PreviewModeDropdown;
