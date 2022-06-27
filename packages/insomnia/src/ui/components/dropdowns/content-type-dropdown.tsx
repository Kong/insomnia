import React, { useCallback } from 'react';

import { SegmentEvent, trackSegmentEvent } from '../../../common/analytics';
import {
  CONTENT_TYPE_EDN,
  CONTENT_TYPE_FILE,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  CONTENT_TYPE_GRAPHQL,
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_OTHER,
  CONTENT_TYPE_PLAINTEXT,
  CONTENT_TYPE_XML,
  CONTENT_TYPE_YAML,
  getContentTypeName,
} from '../../../common/constants';
import type { Request } from '../../../models/request';
import { Dropdown, DropdownProps } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { AlertModal } from '../modals/alert-modal';
import { showModal } from '../modals/index';

interface Props extends DropdownProps {
  onChange: (mimeType: string | null) => void;
  contentType?: string | null;
  className?: string;
  request?: Request;
}
const EMPTY_MIME_TYPE = null;

export const ContentTypeDropdown: React.FC<Props> = ({ children, className, request, contentType, onChange, ...extraProps }) => {
  const handleChangeMimeType = useCallback(async (mimeType: string | null) => {
    if (request) {
      // Nothing to do
      const { body } = request;
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

    onChange(mimeType);
    trackSegmentEvent(SegmentEvent.requestBodyTypeSelect, { type: mimeType });
  }, [onChange, request]);
  const renderMimeType = (mimeType: string | null, forcedName = '') => {
    const contentTypeFallback = typeof contentType === 'string' ? contentType : EMPTY_MIME_TYPE;
    const iconClass = mimeType === contentTypeFallback ? 'fa-check' : 'fa-empty';
    return (
      <DropdownItem onClick={handleChangeMimeType} value={mimeType}>
        <i className={`fa ${iconClass}`} />
        {forcedName || getContentTypeName(mimeType, true)}
      </DropdownItem>
    );
  };
  return (
    <Dropdown beside {...extraProps}>
      <DropdownButton className={className}>{children}</DropdownButton>
      <DropdownDivider>
        <span>
          <i className="fa fa-bars" /> Structured
        </span>
      </DropdownDivider>
      {renderMimeType(CONTENT_TYPE_FORM_DATA)}
      {renderMimeType(CONTENT_TYPE_FORM_URLENCODED)}
      {renderMimeType(CONTENT_TYPE_GRAPHQL)}
      <DropdownDivider>
        <span>
          <i className="fa fa-code" /> Text
        </span>
      </DropdownDivider>
      {renderMimeType(CONTENT_TYPE_JSON)}
      {renderMimeType(CONTENT_TYPE_XML)}
      {renderMimeType(CONTENT_TYPE_YAML)}
      {renderMimeType(CONTENT_TYPE_EDN)}
      {renderMimeType(CONTENT_TYPE_PLAINTEXT)}
      {renderMimeType(CONTENT_TYPE_OTHER)}
      <DropdownDivider>
        <span>
          <i className="fa fa-ellipsis-h" /> Other
        </span>
      </DropdownDivider>
      {renderMimeType(CONTENT_TYPE_FILE)}
      {renderMimeType(EMPTY_MIME_TYPE, 'No Body')}
    </Dropdown>
  );
};
