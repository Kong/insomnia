import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

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
import { isWebSocketRequest } from '../../../models/websocket-request';
import { selectActiveRequest } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { AlertModal } from '../modals/alert-modal';
import { showModal } from '../modals/index';

interface Props {
  onChange: (mimeType: string | null) => void;
}

const EMPTY_MIME_TYPE = null;

const MimeTypeItem: FC<{
  forcedName?: string;
  mimeType: string | null;
  onChange: Props['onChange'];
}> = ({
  forcedName = '',
  mimeType,
  onChange,
}) => {
  const request = useSelector(selectActiveRequest);
  const activeRequest = request && !isWebSocketRequest(request) ? request : null;

  const handleChangeMimeType = useCallback(async (mimeType: string | null) => {
    if (!activeRequest) {
      return;
    }

    const { body } = activeRequest;
    const hasMimeType = 'mimeType' in body;
    if (hasMimeType && body.mimeType === mimeType) {
      // Nothing to do since the mimeType hasn't changed
      return;
    }

    const hasParams = 'params' in body && body.params && body.params.length;
    const hasText = body.text && body.text.length;
    const hasFile = 'fileName' in body && body.fileName && body.fileName.length;
    const isEmpty = !hasParams && !hasText && !hasFile;
    const isFile = hasMimeType && body.mimeType === CONTENT_TYPE_FILE;
    const isMultipart = hasMimeType && body.mimeType === CONTENT_TYPE_FORM_DATA;
    const isFormUrlEncoded = hasMimeType && body.mimeType === CONTENT_TYPE_FORM_URLENCODED;
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

    onChange(mimeType);
    trackSegmentEvent(SegmentEvent.requestBodyTypeSelect, { type: mimeType });
  }, [onChange, activeRequest]);

  const contentType = activeRequest?.body && 'mimeType' in activeRequest.body ? activeRequest.body.mimeType : null;
  const contentTypeFallback = typeof contentType === 'string' ? contentType : EMPTY_MIME_TYPE;
  const iconClass = mimeType === contentTypeFallback ? 'fa-check' : 'fa-empty';
  return (
    <DropdownItem onClick={() => handleChangeMimeType(mimeType)}>
      <i className={`fa ${iconClass}`} />
      {forcedName || getContentTypeName(mimeType, true)}
    </DropdownItem>
  );
};
MimeTypeItem.displayName = DropdownItem.name;

export const ContentTypeDropdown: FC<Props> = ({ onChange }) => {
  const request = useSelector(selectActiveRequest);
  const activeRequest = request && !isWebSocketRequest(request) ? request : null;

  if (!activeRequest) {
    return null;
  }
  const { body } = activeRequest;
  const hasMimeType = 'mimeType' in body;
  const hasParams = body && 'params' in body && body.params;
  const numBodyParams = hasParams ? body.params?.filter(({ disabled }) => !disabled).length : 0;

  return (
    <Dropdown>
      <DropdownButton className="tall">
        {hasMimeType ? getContentTypeName(body.mimeType) : 'Body'}
        {numBodyParams ? <span className="bubble space-left">{numBodyParams}</span> : null}
        <i className="fa fa-caret-down space-left" />
      </DropdownButton>
      <DropdownDivider>
        <span>
          <i className="fa fa-bars" /> Structured
        </span>
      </DropdownDivider>
      <MimeTypeItem mimeType={CONTENT_TYPE_FORM_DATA} onChange={onChange} />
      <MimeTypeItem mimeType={CONTENT_TYPE_FORM_URLENCODED} onChange={onChange} />
      <MimeTypeItem mimeType={CONTENT_TYPE_GRAPHQL} onChange={onChange} />
      <DropdownDivider>
        <span>
          <i className="fa fa-code" /> Text
        </span>
      </DropdownDivider>
      <MimeTypeItem mimeType={CONTENT_TYPE_JSON} onChange={onChange} />
      <MimeTypeItem mimeType={CONTENT_TYPE_XML} onChange={onChange} />
      <MimeTypeItem mimeType={CONTENT_TYPE_YAML} onChange={onChange} />
      <MimeTypeItem mimeType={CONTENT_TYPE_EDN} onChange={onChange} />
      <MimeTypeItem mimeType={CONTENT_TYPE_PLAINTEXT} onChange={onChange} />
      <MimeTypeItem mimeType={CONTENT_TYPE_OTHER} onChange={onChange} />
      <DropdownDivider>
        <span>
          <i className="fa fa-ellipsis-h" /> Other
        </span>
      </DropdownDivider>
      <MimeTypeItem mimeType={CONTENT_TYPE_FILE} onChange={onChange} />
      <MimeTypeItem mimeType={EMPTY_MIME_TYPE} forcedName="No Body" onChange={onChange} />
    </Dropdown>
  );
};
