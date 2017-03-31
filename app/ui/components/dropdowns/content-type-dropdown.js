import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownDivider, DropdownItem} from '../base/dropdown';
import {trackEvent} from '../../../analytics/index';
import {CONTENT_TYPE_FILE, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_JSON, CONTENT_TYPE_OTHER, CONTENT_TYPE_XML, getContentTypeName} from '../../../common/constants';
import {showModal} from '../modals/index';
import AlertModal from '../modals/alert-modal';

const EMPTY_MIME_TYPE = null;

@autobind
class ContentTypeDropdown extends PureComponent {
  async _handleChangeMimeType (mimeType) {
    const {body} = this.props.request;

    // Nothing to do
    if (body.mimeType === mimeType) {
      return;
    }

    const hasParams = body.params && body.params.length;
    const hasText = body.text && body.text.length;
    const hasFile = body.fileName && body.fileName.length;
    const isEmpty = !hasParams && !hasText && !hasFile;

    const isFile = mimeType === CONTENT_TYPE_FILE;
    const isMultipart = mimeType === CONTENT_TYPE_FORM_DATA;
    const canBeText = !isFile && !isMultipart;

    const toFile = body.mimeType === CONTENT_TYPE_FILE;
    const toMultipart = body.mimeType === CONTENT_TYPE_FORM_DATA;
    const toEmpty = !body.mimeType;
    const willBeText = !toFile && !toMultipart;

    const canConvert = canBeText && willBeText && !toEmpty;

    if (!isEmpty && !canConvert) {
      await showModal(AlertModal, {
        title: 'Switch Body Type?',
        message: 'Current body will be lost. Are you sure you want to continue?',
        addCancel: true
      });
    }

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
        {forcedName || getContentTypeName(mimeType, true)}
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
        {this._renderDropdownItem(CONTENT_TYPE_FORM_DATA)}
        {this._renderDropdownItem(CONTENT_TYPE_FORM_URLENCODED)}
        <DropdownDivider><span><i className="fa fa-code"/> Text</span></DropdownDivider>
        {this._renderDropdownItem(CONTENT_TYPE_JSON)}
        {this._renderDropdownItem(CONTENT_TYPE_XML)}
        {this._renderDropdownItem(CONTENT_TYPE_OTHER)}
        <DropdownDivider><span><i className="fa fa-ellipsis-h"/> Other</span></DropdownDivider>
        {this._renderDropdownItem(CONTENT_TYPE_FILE)}
        {this._renderDropdownItem(EMPTY_MIME_TYPE, 'No Body')}
      </Dropdown>
    );
  }
}

ContentTypeDropdown.propTypes = {
  onChange: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,

  // Optional
  contentType: PropTypes.string, // Can be null
  className: PropTypes.string,
  children: PropTypes.node
};

export default ContentTypeDropdown;
