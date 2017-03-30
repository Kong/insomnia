import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownDivider, DropdownItem} from '../base/dropdown';
import {getPreviewModeName, PREVIEW_MODES} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';

@autobind
class PreviewModeDropdown extends PureComponent {
  _handleClick (previewMode) {
    this.props.updatePreviewMode(previewMode);
    trackEvent('Response', 'Preview Mode Change', previewMode);
  }

  renderPreviewMode (mode) {
    const {previewMode} = this.props;
    return (
      <DropdownItem key={mode} onClick={this._handleClick} value={mode}>
        {previewMode === mode ? <i className="fa fa-check"/> : <i className="fa fa-empty"/>}
        {getPreviewModeName(mode, true)}
      </DropdownItem>
    );
  }

  render () {
    const {download} = this.props;
    return (
      <Dropdown>
        <DropdownButton className="tall">
          <i className="fa fa-caret-down"/>
        </DropdownButton>
        <DropdownDivider>Preview Mode</DropdownDivider>
        {PREVIEW_MODES.map(this.renderPreviewMode)}
        <DropdownDivider>Actions</DropdownDivider>
        <DropdownItem onClick={download}>
          <i className="fa fa-save"/>
          Save to File
        </DropdownItem>
      </Dropdown>
    );
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
