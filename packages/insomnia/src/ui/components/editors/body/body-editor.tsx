import clone from 'clone';
import { lookup } from 'mime-types';
import React, { FC, useCallback } from 'react';

import {
  CONTENT_TYPE_FILE,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  CONTENT_TYPE_GRAPHQL,
  getContentTypeFromHeaders,
} from '../../../../common/constants';
import { documentationLinks } from '../../../../common/documentation';
import { getContentTypeHeader } from '../../../../common/misc';
import * as models from '../../../../models';
import type {
  Request,
  RequestBodyParameter,
} from '../../../../models/request';
import {
  newBodyFile,
  newBodyForm,
  newBodyFormUrlEncoded,
  newBodyRaw,
} from '../../../../models/request';
import type { Settings } from '../../../../models/settings';
import type { Workspace } from '../../../../models/workspace';
import { NunjucksEnabledProvider } from '../../../context/nunjucks/nunjucks-enabled-context';
import { AskModal } from '../../modals/ask-modal';
import { showModal } from '../../modals/index';
import { EmptyStatePane } from '../../panes/empty-state-pane';
import { SvgIcon } from '../../svg-icon';
import { FileEditor } from './file-editor';
import { FormEditor } from './form-editor';
import { GraphQLEditor } from './graph-ql-editor';
import { RawEditor } from './raw-editor';
import { UrlEncodedEditor } from './url-encoded-editor';

interface Props {
  request: Request;
  workspace: Workspace;
  settings: Settings;
  environmentId: string;
}

export const BodyEditor: FC<Props> = ({
  request,
  workspace,
  settings,
  environmentId,
}) => {
  const handleRawChange = useCallback((rawValue: string) => {
    const oldContentType = request.body.mimeType || '';
    const body = newBodyRaw(rawValue, oldContentType);
    models.request.update(request, { body });
  }, [request]);

  const handleGraphQLChange = useCallback((content: string) => {
    const body = newBodyRaw(content, CONTENT_TYPE_GRAPHQL);
    models.request.update(request, { body });
  }, [request]);

  const handleFormUrlEncodedChange = useCallback((parameters: RequestBodyParameter[]) => {
    const body = newBodyFormUrlEncoded(parameters);
    models.request.update(request, { body });
  }, [request]);

  const handleFormChange = useCallback((parameters: RequestBodyParameter[]) => {
    const body = newBodyForm(parameters);
    models.request.update(request, { body });
  }, [request]);

  const handleFileChange = async (path: string) => {
    const headers = clone(request.headers);
    const body = newBodyFile(path);
    const newRequest = await models.request.update(request, { body });
    let contentTypeHeader = getContentTypeHeader(headers);

    if (!contentTypeHeader) {
      contentTypeHeader = {
        name: 'Content-Type',
        value: CONTENT_TYPE_FILE,
      };
      headers.push(contentTypeHeader);
    }

    // Update Content-Type header if the user wants
    const contentType = contentTypeHeader.value;
    const newContentType = lookup(path) || CONTENT_TYPE_FILE;

    if (contentType !== newContentType && path) {
      contentTypeHeader.value = newContentType;
      showModal(AskModal, {
        title: 'Change Content-Type',
        message: <p>
          Do you want set the <span className="monospace">Content-Type</span> header to{' '}
          <span className="monospace">{newContentType}</span>?
        </p>,
        onDone: (saidYes: boolean) => {
          if (saidYes) {
            models.request.update(newRequest, { headers });
          }
        },
      });
    }
  };

  const noRender = request.settingDisableRenderRequestBody;
  const uniqueKey = `${request._id}::${noRender ? 'no-render' : 'render'}`;
  const fileName = request.body.fileName;
  const mimeType = request.body.mimeType;
  const isBodyEmpty = typeof mimeType !== 'string' && !request.body.text;

  const _render = () => {
    if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
      return <UrlEncodedEditor key={uniqueKey} onChange={handleFormUrlEncodedChange} parameters={request.body.params || []} />;
    } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
      return <FormEditor key={uniqueKey} onChange={handleFormChange} parameters={request.body.params || []} />;
    } else if (mimeType === CONTENT_TYPE_FILE) {
      return <FileEditor key={uniqueKey} onChange={handleFileChange} path={fileName || ''} />;
    } else if (mimeType === CONTENT_TYPE_GRAPHQL) {
      return <GraphQLEditor key={uniqueKey} uniquenessKey={uniqueKey} request={request} settings={settings} workspaceId={workspace._id} environmentId={environmentId} onChange={handleGraphQLChange} />;
    } else if (!isBodyEmpty) {
      const contentType = getContentTypeFromHeaders(request.headers) || mimeType;
      return <RawEditor uniquenessKey={uniqueKey} contentType={contentType || 'text/plain'} content={request.body.text || ''} onChange={handleRawChange} />;
    } else {
      return <EmptyStatePane icon={<SvgIcon icon="bug" />} documentationLinks={[documentationLinks.introductionToInsomnia]} secondaryAction="Select a body type from above to send data in the body of a request" title="Enter a URL and send to get a response" />;
    }
  };

  return <NunjucksEnabledProvider disable={noRender}>{_render()}</NunjucksEnabledProvider>;
};
