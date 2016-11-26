import React, {PropTypes, Component} from 'react';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';
import {contentTypesMap} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';
import * as constants from '../../../common/constants';
import {getContentTypeName} from '../../../common/constants';

class ContentTypeDropdown extends Component {
  _renderDropdownItem (mimeType, iconClass, forcedName = null) {
    return (
      <DropdownItem onClick={e => {
        this.props.updateRequestMimeType(mimeType);
        trackEvent('Request', 'Content-Type Change', contentTypesMap[mimeType]);
      }}>
        <i className={`fa ${iconClass || 'fa-empty'}`}/>
        {forcedName || getContentTypeName(mimeType)}
      </DropdownItem>
    )
  }

  render () {
    const {children, className} = this.props;
    return (
      <Dropdown debug="true">
        <DropdownButton className={className}>
          {children}
        </DropdownButton>
        <DropdownDivider name="Form Data"/>
        {this._renderDropdownItem(constants.CONTENT_TYPE_FORM_DATA, 'fa-bars')}
        {this._renderDropdownItem(constants.CONTENT_TYPE_FORM_URLENCODED, 'fa-bars')}
        <DropdownDivider name="Raw Text"/>
        {this._renderDropdownItem(constants.CONTENT_TYPE_JSON, 'fa-code')}
        {this._renderDropdownItem(constants.CONTENT_TYPE_XML, 'fa-code')}
        {this._renderDropdownItem(constants.CONTENT_TYPE_OTHER, 'fa-code')}
        <DropdownDivider name="Other"/>
        {this._renderDropdownItem(constants.CONTENT_TYPE_FILE, 'fa-file-o')}
        {this._renderDropdownItem(null, 'fa-ban', 'No Body')}
      </Dropdown>
    )
  }
}

ContentTypeDropdown.propTypes = {
  updateRequestMimeType: PropTypes.func.isRequired
};

export default ContentTypeDropdown;
