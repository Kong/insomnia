import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownDivider, DropdownItem} from '../base/dropdown';
import {trackEvent} from '../../../analytics/index';
import * as constants from '../../../common/constants';

const EMPTY_MIME_TYPE = null;

@autobind
class ContentTypeDropdown extends PureComponent {
  _handleChangeMimeType (mimeType) {
    this.props.onChange(mimeType);
    trackEvent('Request', 'Content-Type Change', mimeType);
  }

  _renderDropdownItem (mimeType, forcedName = null) {
    const contentType = typeof this.props.contentType !== 'string'
      ? EMPTY_MIME_TYPE : this.props.contentType;

    const iconClass = mimeType === contentType ? 'fa-check' : 'fa-empty';

    return (
      <DropdownItem onClick={this._handleChangeMimeType} value={mimeType}>
        <i className={`fa ${iconClass}`}/>
        {forcedName || constants.getContentTypeName(mimeType, true)}
      </DropdownItem>
    );
  }

  render () {
    const {children, className, ...extraProps} = this.props;
    return (
      <Dropdown debug="true" {...extraProps}>
        <DropdownButton className={className}>
          {children}
        </DropdownButton>
        <DropdownDivider><span><i className="fa fa-bars"/> Form Data</span></DropdownDivider>
        {this._renderDropdownItem(constants.CONTENT_TYPE_FORM_DATA)}
        {this._renderDropdownItem(constants.CONTENT_TYPE_FORM_URLENCODED)}
        <DropdownDivider><span><i className="fa fa-code"/> Text</span></DropdownDivider>
        {this._renderDropdownItem(constants.CONTENT_TYPE_JSON)}
        {this._renderDropdownItem(constants.CONTENT_TYPE_XML)}
        {this._renderDropdownItem(constants.CONTENT_TYPE_OTHER)}
        <DropdownDivider><span><i className="fa fa-ellipsis-h"/> Other</span></DropdownDivider>
        {this._renderDropdownItem(constants.CONTENT_TYPE_FILE)}
        {this._renderDropdownItem(EMPTY_MIME_TYPE, 'No Body')}
      </Dropdown>
    );
  }
}

ContentTypeDropdown.propTypes = {
  onChange: PropTypes.func.isRequired,

  // Optional
  contentType: PropTypes.string, // Can be null
  className: PropTypes.string,
  children: PropTypes.node
};

export default ContentTypeDropdown;
