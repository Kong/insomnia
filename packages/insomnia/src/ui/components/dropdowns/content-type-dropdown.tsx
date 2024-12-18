import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { type FC } from 'react';
import { Button, Collection, Header, ListBox, ListBoxItem, Popover, Section, Select, SelectValue } from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router-dom';

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
  METHOD_POST,
} from '../../../common/constants';
import type { Request, RequestBody, RequestHeader, RequestParameter } from '../../../models/request';
import { deconstructQueryStringToParams } from '../../../utils/url/querystring';
import { SegmentEvent } from '../../analytics';
import { useRequestPatcher } from '../../hooks/use-request';
import type { RequestLoaderData } from '../../routes/request';
import { Icon } from '../icon';
import { showAlert } from '../modals/index';

const EMPTY_MIME_TYPE = null;

const contentTypeSections: {
  id: string;
  icon: IconName;
  name: string;
  items: {
    id: string;
    name: string;
  }[];
}[] = [
    {
      id: 'structured',
      name: 'Structured',
      icon: 'bars',
      items: [
        {
          id: CONTENT_TYPE_FORM_DATA,
          name: 'Form Data',
        },
        {
          id: CONTENT_TYPE_FORM_URLENCODED,
          name: 'Form URL Encoded',
        },
        {
          id: CONTENT_TYPE_GRAPHQL,
          name: 'GraphQL',
        },
      ],
    },
    {
      id: 'text',
      icon: 'code',
      name: 'Text',
      items: [
        {
          id: CONTENT_TYPE_JSON,
          name: 'JSON',
        },
        {
          id: CONTENT_TYPE_XML,
          name: 'XML',
        },
        {
          id: CONTENT_TYPE_YAML,
          name: 'YAML',
        },
        {
          id: CONTENT_TYPE_EDN,
          name: 'EDN',
        },
        {
          id: CONTENT_TYPE_PLAINTEXT,
          name: 'Plain Text',
        },
        {
          id: CONTENT_TYPE_OTHER,
          name: 'Other',
        },
      ],
    },
    {
      id: 'other',
      icon: 'ellipsis-h',
      name: 'Other',
      items: [
        {
          id: CONTENT_TYPE_FILE,
          name: 'File',
        },
        {
          id: 'no-body',
          name: 'No Body',
        },
      ],
    },
  ];

export const ContentTypeDropdown: FC = () => {
  const { activeRequest } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const patchRequest = useRequestPatcher();
  const { requestId } = useParams() as { requestId: string };
  const handleChangeMimeType = async (mimeType: string | null) => {
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
      showAlert({
        title: 'Switch Body Type?',
        message: 'Current body will be lost. Are you sure you want to continue?',
        addCancel: true,
        onConfirm: async () => {
          patchRequest(requestId, { body: { mimeType } });
          window.main.trackSegmentEvent({ event: SegmentEvent.requestBodyTypeSelect, properties: { type: mimeType } });
        },
      });
    } else {
      patchRequest(requestId, { body: { mimeType } });
      window.main.trackSegmentEvent({ event: SegmentEvent.requestBodyTypeSelect, properties: { type: mimeType } });
    }
  };

  const { body } = activeRequest;
  const hasMimeType = 'mimeType' in body;
  const hasParams = body && 'params' in body && body.params;
  const numBodyParams = hasParams ? body.params?.filter(({ disabled }) => !disabled).length : 0;

  return (
    <Select
      aria-label="Change Body Type"
      name="body-type"
      onSelectionChange={mimeType => {
        if (mimeType === 'no-body') {
          handleChangeMimeType(EMPTY_MIME_TYPE);
        } else {
          handleChangeMimeType(mimeType.toString());
        }
      }}
      selectedKey={body.mimeType ?? 'no-body'}
    >
      <Button className="px-4 min-w-[12ch] py-1 font-bold flex flex-1 items-center justify-between gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
        <SelectValue className="flex truncate items-center justify-center gap-2">
          <div className='flex items-center gap-2 text-[--hl]'>
            {hasMimeType ? getContentTypeName(body.mimeType) : 'No Body'}
            {numBodyParams ?
              <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
                {numBodyParams}
              </span>
              : null}
          </div>
        </SelectValue>
        <Icon icon="caret-down" />
      </Button>
      <Popover className="min-w-max overflow-y-hidden flex flex-col">
        <ListBox
          items={contentTypeSections}
          className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
        >
          {section => (
            <Section>
              <Header className='pl-2 py-1 flex items-center gap-2 text-[--hl] text-xs uppercase'>
                <Icon icon={section.icon} /> <span>{section.name}</span>
              </Header>
              <Collection items={section.items}>
                {item => (
                  <ListBoxItem
                    className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                    aria-label={item.name}
                    textValue={item.name}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>{item.name}</span>
                        {isSelected && (
                          <Icon
                            icon="check"
                            className="text-[--color-success] justify-self-end"
                          />
                        )}
                      </>
                    )}
                  </ListBoxItem>
                )}
              </Collection>
            </Section>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
};

export function newBodyGraphQL(rawBody: string): RequestBody {
  try {
    // Only strip the newlines if rawBody is a parsable JSON
    JSON.parse(rawBody);
    return {
      mimeType: CONTENT_TYPE_GRAPHQL,
      text: rawBody.replace(/\\\\n/g, ''),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        mimeType: CONTENT_TYPE_GRAPHQL,
        text: rawBody,
      };
    } else {
      throw error;
    }
  }
}

export const updateMimeType = (
  request: Request,
  mimeType: string | null,
): { body: RequestBody; headers: RequestHeader[]; params?: RequestParameter[]; method?: string } => {
  const withoutContentType = request.headers.filter(h => h?.name?.toLowerCase() !== 'content-type');
  // 'No body' selected
  if (typeof mimeType !== 'string') {
    return {
      body: {},
      headers: withoutContentType,
    };
  }
  if (mimeType === CONTENT_TYPE_GRAPHQL) {
    return {
      body: newBodyGraphQL(request.body.text || ''),
      headers: [{ name: 'Content-Type', value: CONTENT_TYPE_JSON }, ...withoutContentType],
      method: METHOD_POST,
    };
  }
  if (mimeType === CONTENT_TYPE_FORM_URLENCODED || mimeType === CONTENT_TYPE_FORM_DATA) {
    const params = request.body.params || deconstructQueryStringToParams(request.body.text);
    return {
      body: { mimeType, params },
      headers: [{ name: 'Content-Type', value: mimeType || '' }, ...withoutContentType],
    };
  }
  if (mimeType === CONTENT_TYPE_FILE) {
    return {
      body: { mimeType, fileName: '' },
      headers: [{ name: 'Content-Type', value: mimeType || '' }, ...withoutContentType],
    };
  }
  return {
    body: { mimeType: mimeType.split(';')[0], text: request.body.text || '' },
    headers: [{ name: 'Content-Type', value: mimeType || '' }, ...withoutContentType],
  };
};
