import React, {PropTypes} from 'react';

import Dropdown from '../base/Dropdown';
import {PREVIEW_MODES, getPreviewModeName} from 'backend/previewModes';
import {trackEvent} from 'backend/analytics';

const PreviewModeDropdown = ({updatePreviewMode}) => {
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
      </ul>
    </Dropdown>
  )
};

PreviewModeDropdown.propTypes = {
  // Functions
  updatePreviewMode: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired
};

export default PreviewModeDropdown;
