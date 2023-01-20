import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

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
import { SegmentEvent, trackSegmentEvent } from '../../analytics';
import { selectActiveRequest } from '../../redux/selectors';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { AlertModal } from '../modals/alert-modal';
import { showModal } from '../modals/index';

interface Props {
  onChange: (mimeType: string | null) => void;
}

const EMPTY_MIME_TYPE = null;

export const ContentTypeDropdown: FC<Props> = ({ onChange }) => {
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

  if (!activeRequest) {
    return null;
  }
  const { body } = activeRequest;
  const hasMimeType = 'mimeType' in body;
  const hasParams = body && 'params' in body && body.params;
  const numBodyParams = hasParams ? body.params?.filter(({ disabled }) => !disabled).length : 0;

  const getIcon = (mimeType: string | null) => {
    const contentType = activeRequest?.body && 'mimeType' in activeRequest.body ? activeRequest.body.mimeType : null;
    const contentTypeFallback = typeof contentType === 'string' ? contentType : EMPTY_MIME_TYPE;

    return mimeType === contentTypeFallback ? 'check' : 'empty';
  };

  return (
    <Dropdown
      aria-label='Change Body Type'
      triggerButton={
        <DropdownButton>
          {hasMimeType ? getContentTypeName(body.mimeType) : 'Body'}
          {numBodyParams ? <span className="bubble space-left">{numBodyParams}</span> : null}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
      }
    >
      <DropdownSection
        aria-label='Structured Type Section'
        title={
          <span>
            <i className="fa fa-bars" /> Structured
          </span>
        }
      >
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_FORM_DATA, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_FORM_DATA)}
            label={getContentTypeName(CONTENT_TYPE_FORM_DATA, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_FORM_DATA)}
          />
        </DropdownItem>
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_FORM_URLENCODED, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_FORM_URLENCODED)}
            label={getContentTypeName(CONTENT_TYPE_FORM_URLENCODED, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_FORM_URLENCODED)}
          />
        </DropdownItem>
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_GRAPHQL, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_GRAPHQL)}
            label={getContentTypeName(CONTENT_TYPE_GRAPHQL, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_GRAPHQL)}
          />
        </DropdownItem>
      </DropdownSection>

      <DropdownSection
        aria-label='Text Type Section'
        title={
          <span>
            <i className="fa fa-code" /> Text
          </span>
        }
      >
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_JSON, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_JSON)}
            label={getContentTypeName(CONTENT_TYPE_JSON, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_JSON)}
          />
        </DropdownItem>
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_XML, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_XML)}
            label={getContentTypeName(CONTENT_TYPE_XML, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_XML)}
          />
        </DropdownItem>
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_YAML, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_YAML)}
            label={getContentTypeName(CONTENT_TYPE_YAML, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_YAML)}
          />
        </DropdownItem>
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_EDN, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_EDN)}
            label={getContentTypeName(CONTENT_TYPE_EDN, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_EDN)}
          />
        </DropdownItem>
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_PLAINTEXT, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_PLAINTEXT)}
            label={getContentTypeName(CONTENT_TYPE_PLAINTEXT, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_PLAINTEXT)}
          />
        </DropdownItem>
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_OTHER, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_OTHER)}
            label={getContentTypeName(CONTENT_TYPE_OTHER, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_OTHER)}
          />
        </DropdownItem>
      </DropdownSection>

      <DropdownSection
        aria-label='Other Type Section'
        title={
          <span>
            <i className="fa fa-ellipsis-h" /> Other
          </span>
        }
      >
        <DropdownItem aria-label={getContentTypeName(CONTENT_TYPE_FILE, true)}>
          <ItemContent
            icon={getIcon(CONTENT_TYPE_FILE)}
            label={getContentTypeName(CONTENT_TYPE_FILE, true)}
            onClick={() => handleChangeMimeType(CONTENT_TYPE_FILE)}
          />
        </DropdownItem>
        <DropdownItem aria-label="No Body">
          <ItemContent
            icon={getIcon(EMPTY_MIME_TYPE)}
            label="No Body"
            onClick={() => handleChangeMimeType(EMPTY_MIME_TYPE)}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
