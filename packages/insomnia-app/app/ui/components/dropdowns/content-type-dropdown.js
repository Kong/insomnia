// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import {
  CONTENT_TYPE_FILE,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  CONTENT_TYPE_GRAPHQL,
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_YAML,
  CONTENT_TYPE_OTHER,
  CONTENT_TYPE_XML,
  CONTENT_TYPE_EDN,
  getContentTypeName,
} from '../../../common/constants';
import { showModal } from '../modals/index';
import AlertModal from '../modals/alert-modal';
import type { Request, RequestBody } from '../../../models/request';
import { trackEvent } from '../../../common/analytics';

type Props = {
  onChange: Function,
  contentType: ?string,
  children: ?React.Node,

  // Optional
  className?: string,
  request?: Request,
};

const EMPTY_MIME_TYPE = null;

@autobind
class ContentTypeDropdown extends React.PureComponent<Props> {
  async _checkMimeTypeChange(body: RequestBody, mimeType: string | null) {
    // Nothing to do
    if (body.mimeType === mimeType) {
      return;
    }

    const hasParams = body.params && body.params.length;
    const hasText = body.text && body.text.length;
    const hasFile = body.fileName && body.fileName.length;
    const isEmpty = !hasParams && !hasText && !hasFile;
    const isFile = body.mimeType === CONTENT_TYPE_FILE;
    const isMultipart = body.mimeType === CONTENT_TYPE_FORM_DATA;
    const isFormUrlEncoded = body.mimeType === CONTENT_TYPE_FORM_URLENCODED;
    const isText = !isFile && !isMultipart;

    const willBeFile = mimeType === CONTENT_TYPE_FILE;
    const willBeMultipart = mimeType === CONTENT_TYPE_FORM_DATA;
    const willBeGraphQL = mimeType === CONTENT_TYPE_GRAPHQL;

    const willConvertToText = !willBeGraphQL && !willBeFile && !willBeMultipart;
    const willPreserveText = willConvertToText && isText;
    const willPreserveForm = isFormUrlEncoded && willBeMultipart;

    if (!isEmpty && !willPreserveText && !willPreserveForm) {
      await showModal(AlertModal, {
        title: 'Switch Body Type?',
        message: 'Current body will be lost. Are you sure you want to continue?',
        addCancel: true,
      });
    }
  }

  async _handleChangeMimeType(mimeType: string | null) {
    const { request } = this.props;

    if (request) {
      await this._checkMimeTypeChange(request.body, mimeType);
    }

    this.props.onChange(mimeType);

    trackEvent('Request', 'Change MimeType', mimeType);
  }

  _renderDropdownItem(mimeType: string | null, forcedName: string = '') {
    const contentType =
      typeof this.props.contentType === 'string' ? this.props.contentType : EMPTY_MIME_TYPE;

    const iconClass = mimeType === contentType ? 'fa-check' : 'fa-empty';

    return (
      <DropdownItem onClick={this._handleChangeMimeType} value={mimeType}>
        <i className={`fa ${iconClass}`} />
        {forcedName || getContentTypeName(mimeType, true)}
      </DropdownItem>
    );
  }

  render() {
    const { children, className, ...extraProps } = this.props;
    return (
      <Dropdown beside {...(extraProps: Object)}>
        <DropdownButton className={className}>{children}</DropdownButton>
        <DropdownDivider>
          <span>
            <i className="fa fa-bars" /> Structured
          </span>
        </DropdownDivider>
        {this._renderDropdownItem(CONTENT_TYPE_FORM_DATA)}
        {this._renderDropdownItem(CONTENT_TYPE_FORM_URLENCODED)}
        {this._renderDropdownItem(CONTENT_TYPE_GRAPHQL)}
        <DropdownDivider>
          <span>
            <i className="fa fa-code" /> Text
          </span>
        </DropdownDivider>
        {this._renderDropdownItem(CONTENT_TYPE_JSON)}
        {this._renderDropdownItem(CONTENT_TYPE_XML)}
        {this._renderDropdownItem(CONTENT_TYPE_YAML)}
        {this._renderDropdownItem(CONTENT_TYPE_EDN)}
        {this._renderDropdownItem(CONTENT_TYPE_OTHER)}
        <DropdownDivider>
          <span>
            <i className="fa fa-ellipsis-h" /> Other
          </span>
        </DropdownDivider>
        {this._renderDropdownItem(CONTENT_TYPE_FILE)}
        {this._renderDropdownItem(EMPTY_MIME_TYPE, 'No Body')}
      </Dropdown>
    );
  }
}

export default ContentTypeDropdown;
