import React, {PropTypes, Component} from 'react';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';
import {contentTypesMap} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';
import * as constants from '../../../common/constants';
import {getContentTypeName} from '../../../common/constants';

const EMPTY_MIME_TYPE = null;

class ContentTypeDropdown extends Component {
  _handleChangeMimeType = mimeType => {
    this.props.onChange(mimeType);
    trackEvent('Request', 'Content-Type Change', contentTypesMap[mimeType]);
  };

  _renderDropdownItem (mimeType, forcedName = null) {
    const contentType = typeof this.props.contentType !== 'string' ?
      EMPTY_MIME_TYPE : this.props.contentType;

    const iconClass = mimeType === contentType ? 'fa-check' : 'fa-empty';

    return (
      <DropdownItem onClick={this._handleChangeMimeType} value={mimeType}>
        <i className={`fa ${iconClass}`}/>
        {forcedName || getContentTypeName(mimeType)}
      </DropdownItem>
    )
  }

  render () {
    const {children, className, ...extraProps} = this.props;
    return (
      <Dropdown debug="true" {...extraProps}>
        <DropdownButton className={className}>
          {children}
        </DropdownButton>
        <DropdownDivider name={<span><i className="fa fa-bars"></i> Form Data</span>}/>
        {this._renderDropdownItem(constants.CONTENT_TYPE_FORM_DATA)}
        {this._renderDropdownItem(constants.CONTENT_TYPE_FORM_URLENCODED)}
        <DropdownDivider name={<span><i className="fa fa-code"></i> Raw Text</span>}/>
        {this._renderDropdownItem(constants.CONTENT_TYPE_JSON)}
        {this._renderDropdownItem(constants.CONTENT_TYPE_XML)}
        {this._renderDropdownItem(constants.CONTENT_TYPE_OTHER)}
        <DropdownDivider name={<span><i className="fa fa-ellipsis-h"></i> Other</span>}/>
        {this._renderDropdownItem(constants.CONTENT_TYPE_FILE)}
        {this._renderDropdownItem(EMPTY_MIME_TYPE, 'No Body')}
      </Dropdown>
    )
  }
}

ContentTypeDropdown.propTypes = {
  onChange: PropTypes.func.isRequired,

  // Optional
  contentType: PropTypes.string, // Can be null
};

export default ContentTypeDropdown;
