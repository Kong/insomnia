import React, {PureComponent, PropTypes} from 'react';
import {Dropdown, DropdownDivider, DropdownButton, DropdownItem} from '../base/dropdown';
import {PREVIEW_MODES, getPreviewModeName} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';

class PreviewModeDropdown extends PureComponent {
  _handleClick = previewMode => {
    this.props.updatePreviewMode(previewMode);
    trackEvent('Response', 'Preview Mode Change', mode);
  };

  render () {
    const {download, previewMode} = this.props;
    return (
      <Dropdown>
        <DropdownButton className="tall">
          <i className="fa fa-caret-down"></i>
        </DropdownButton>
        <DropdownDivider name="Preview Mode"/>
        {PREVIEW_MODES.map(mode => (
          <DropdownItem key={mode} onClick={this._handleClick} value={mode}>
            {previewMode === mode ? <i className="fa fa-check"/> : <i className="fa fa-empty"/>}
            {getPreviewModeName(mode)}
          </DropdownItem>
        ))}
        <DropdownDivider name="Actions"/>
        <DropdownItem onClick={download}>
          <i className="fa fa-save"></i>
          Save to File
        </DropdownItem>
      </Dropdown>
    )
  }
}

PreviewModeDropdown.propTypes = {
  // Functions
  updatePreviewMode: PropTypes.func.isRequired,
  download: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired
};

export default PreviewModeDropdown;
