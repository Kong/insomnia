import React, {PropTypes} from 'react'

import Dropdown from '../components/base/Dropdown'
import {PREVIEW_MODES, getPreviewModeName} from '../lib/previewModes'

const PreviewModeDropdown = ({updatePreviewMode}) => {
  return (
    <Dropdown>
      <button><i className="fa fa-caret-down"></i></button>
      <ul>
        {PREVIEW_MODES.map(previewMode => (
          <li key={previewMode}>
            <button onClick={e => updatePreviewMode(previewMode)}>
              {getPreviewModeName(previewMode)}
            </button>
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
