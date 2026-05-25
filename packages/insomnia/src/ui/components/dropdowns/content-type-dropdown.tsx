import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { type FC } from 'react';
import {
  Button,
  Collection,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components';
import { useParams } from 'react-router';

import type { Request, RequestBody, RequestHeader, RequestParameter } from '~/insomnia-data';
import { deconstructQueryStringToParams } from '~/insomnia-data/common';

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
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { AnalyticsEvent } from '../../analytics';
import { useRequestPatcher } from '../../hooks/use-request';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';

const EMPTY_MIME_TYPE = null;

export const ContentTypeDropdown: FC = () => {
  const { activeRequest } = useRequestLoaderData()! as RequestLoaderData;
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
      showModal(AlertModal, {
        title: 'Switch Body Type?',
        message: 'Current body will be lost. Are you sure you want to continue?',
        addCancel: true,
        onConfirm: async () => {
          patchRequest(requestId, { body: { mimeType } });
          window.main.trackAnalyticsEvent({
            event: AnalyticsEvent.requestBodyTypeSelect,
            properties: { type: mimeType },
          });
        },
      });
    } else {
      patchRequest(requestId, { body: { mimeType } });
      window.main.trackAnalyticsEvent({ event: AnalyticsEvent.requestBodyTypeSelect, properties: { type: mimeType } });
    }
  };

  const { body } = activeRequest;
  const hasMimeType = 'mimeType' in body;
  const hasParams = body && 'params' in body && body.params;
  const numBodyParams = hasParams ? body.params?.filter(({ disabled }) => !disabled).length : 0;

  // !Note: after bumping react-aria-components to 1.12.2, the ListBox Collection items are missing once the outer key changes and the items' reference is not changed. So here we always use the new array reference to force the ListBox to re-render.
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
  return (
    <Select
      aria-label="Change Body Type"
      name="body-type"
      onSelectionChange={mimeType => {
        if (mimeType === 'no-body') {
          handleChangeMimeType(EMPTY_MIME_TYPE);
          return;
        }
        mimeType && handleChangeMimeType(mimeType.toString());
      }}
      selectedKey={body.mimeType ?? 'no-body'}
    >
      <Button className="flex min-w-[12ch] flex-1 items-center justify-between gap-2 rounded-xs px-4 py-1 text-sm font-bold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
        <SelectValue className="flex items-center justify-center gap-2 truncate">
          <div className="flex items-center gap-2 text-(--hl)">
            {hasMimeType ? getContentTypeName(body.mimeType) : 'No Body'}
            {numBodyParams ? (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs">
                {numBodyParams}
              </span>
            ) : null}
          </div>
        </SelectValue>
        <Icon icon="caret-down" />
      </Button>
      <Popover className="flex min-w-max flex-col overflow-y-hidden">
        <ListBox
          items={contentTypeSections}
          className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
        >
          {section => (
            <ListBoxSection>
              <Header className="flex items-center gap-2 py-1 pl-2 text-xs text-(--hl) uppercase">
                <Icon icon={section.icon} /> <span>{section.name}</span>
              </Header>
              <Collection items={section.items}>
                {item => (
                  <ListBoxItem
                    className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                    aria-label={item.name}
                    textValue={item.name}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>{item.name}</span>
                        {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                      </>
                    )}
                  </ListBoxItem>
                )}
              </Collection>
            </ListBoxSection>
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
    }
    throw error;
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
