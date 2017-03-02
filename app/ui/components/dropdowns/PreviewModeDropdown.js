import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownDivider, DropdownButton, DropdownItem} from '../base/dropdown';
import {PREVIEW_MODES, getPreviewModeName} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';

@autobind
class PreviewModeDropdown extends PureComponent {
  constructor (props) {
    super(props);
  }

  _handleClick (previewMode) {
    this.props.updatePreviewMode(previewMode);
    trackEvent('Response', 'Preview Mode Change', previewMode);
  }

  render () {
    const {download, previewMode} = this.props;
    return (
      <Dropdown>
        <DropdownButton className="tall">
          <i className="fa fa-caret-down"></i>
        </DropdownButton>
        <DropdownDivider>Preview Mode</DropdownDivider>
        {PREVIEW_MODES.map(mode => (
          <DropdownItem key={mode} onClick={this._handleClick} value={mode}>
            {previewMode === mode ? <i className="fa fa-check"/> : <i className="fa fa-empty"/>}
            {getPreviewModeName(mode)}
          </DropdownItem>
        ))}
        <DropdownDivider>Actions</DropdownDivider>
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
