import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem
} from '../base/dropdown';
import { getPreviewModeName, PREVIEW_MODES } from '../../../common/constants';

@autobind
class PreviewModeDropdown extends PureComponent {
  _handleClick(previewMode) {
    this.props.updatePreviewMode(previewMode);
  }

  renderPreviewMode(mode) {
    const { previewMode } = this.props;
    return (
      <DropdownItem key={mode} onClick={this._handleClick} value={mode}>
        {previewMode === mode ? (
          <i className="fa fa-check" />
        ) : (
          <i className="fa fa-empty" />
        )}
        {getPreviewModeName(mode, true)}
      </DropdownItem>
    );
  }

  render() {
    const { download, fullDownload, previewMode } = this.props;
    return (
      <Dropdown beside>
        <DropdownButton className="tall">
          {getPreviewModeName(previewMode)}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
        <DropdownDivider>Preview Mode</DropdownDivider>
        {PREVIEW_MODES.map(this.renderPreviewMode)}
        <DropdownDivider>Actions</DropdownDivider>
        <DropdownItem onClick={download}>
          <i className="fa fa-save" />
          Save Response Body
        </DropdownItem>
        <DropdownItem onClick={fullDownload}>
          <i className="fa fa-save" />
          Save Full Response
        </DropdownItem>
      </Dropdown>
    );
  }
}

PreviewModeDropdown.propTypes = {
  // Functions
  updatePreviewMode: PropTypes.func.isRequired,
  download: PropTypes.func.isRequired,
  fullDownload: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired
};

export default PreviewModeDropdown;
