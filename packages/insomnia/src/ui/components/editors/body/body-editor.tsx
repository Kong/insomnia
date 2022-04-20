import { autoBindMethodsForReact } from 'class-autobind-decorator';
import clone from 'clone';
import { SvgIcon } from 'insomnia-components';
import { lookup } from 'mime-types';
import React, { PureComponent } from 'react';

import {
  AUTOBIND_CFG,
  CONTENT_TYPE_FILE,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  CONTENT_TYPE_GRAPHQL,
  getContentTypeFromHeaders,
} from '../../../../common/constants';
import { documentationLinks } from '../../../../common/documentation';
import { getContentTypeHeader } from '../../../../common/misc';
import type {
  Request,
  RequestBody,
  RequestBodyParameter,
  RequestHeader,
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
import { FileEditor } from './file-editor';
import { FormEditor } from './form-editor';
import { GraphQLEditor } from './graph-ql-editor';
import { RawEditor } from './raw-editor';
import { UrlEncodedEditor } from './url-encoded-editor';

interface Props {
  onChange: (r: Request, body: RequestBody) => Promise<Request>;
  onChangeHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  handleUpdateRequestMimeType: (mimeType: string | null) => Promise<Request | null>;
  request: Request;
  workspace: Workspace;
  settings: Settings;
  environmentId: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class BodyEditor extends PureComponent<Props> {
  _handleRawChange(rawValue: string) {
    const { onChange, request } = this.props;
    const oldContentType = request.body.mimeType || '';
    const newBody = newBodyRaw(rawValue, oldContentType);
    onChange(request, newBody);
  }

  _handleGraphQLChange(content: string) {
    const { onChange, request } = this.props;
    const newBody = newBodyRaw(content, CONTENT_TYPE_GRAPHQL);
    onChange(request, newBody);
  }

  _handleFormUrlEncodedChange(parameters: RequestBodyParameter[]) {
    const { onChange, request } = this.props;
    const newBody = newBodyFormUrlEncoded(parameters);
    onChange(request, newBody);
  }

  _handleFormChange(parameters: RequestBodyParameter[]) {
    const { onChange, request } = this.props;
    const newBody = newBodyForm(parameters);
    onChange(request, newBody);
  }

  async _handleFileChange(path: string) {
    const { onChange, onChangeHeaders, request } = this.props;
    const headers = clone(request.headers);
    const newBody = newBodyFile(path);
    const newRequest = await onChange(request, newBody);
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
        message: (
          <p>
            Do you want set the <span className="monospace">Content-Type</span> header to{' '}
            <span className="monospace">{newContentType}</span>?
          </p>
        ),
        onDone: saidYes => {
          if (saidYes) {
            onChangeHeaders(newRequest, headers);
          }
        },
      });
    }
  }

  render() {
    const {
      request,
      workspace,
      settings,
      environmentId,
    } = this.props;
    const noRender = request.settingDisableRenderRequestBody;
    const uniqueKey = `${request._id}::${noRender ? 'no-render' : 'render'}`;
    const fileName = request.body.fileName;
    const mimeType = request.body.mimeType;
    const isBodyEmpty = typeof mimeType !== 'string' && !request.body.text;

    const _render = () => {
      if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
        return (
          <UrlEncodedEditor
            key={uniqueKey}
            onChange={this._handleFormUrlEncodedChange}
            parameters={request.body.params || []}
          />
        );
      } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
        return (
          <FormEditor
            key={uniqueKey}
            onChange={this._handleFormChange}
            parameters={request.body.params || []}
          />
        );
      } else if (mimeType === CONTENT_TYPE_FILE) {
        return <FileEditor key={uniqueKey} onChange={this._handleFileChange} path={fileName || ''} />;
      } else if (mimeType === CONTENT_TYPE_GRAPHQL) {
        return (
          <GraphQLEditor
            key={uniqueKey}
            uniquenessKey={uniqueKey}
            request={request}
            content={request.body.text || ''}
            workspace={workspace}
            settings={settings}
            environmentId={environmentId}
            onChange={this._handleGraphQLChange}
          />
        );
      } else if (!isBodyEmpty) {
        const contentType = getContentTypeFromHeaders(request.headers) || mimeType;
        return (
          <RawEditor
            uniquenessKey={uniqueKey}
            contentType={contentType || 'text/plain'}
            content={request.body.text || ''}
            onChange={this._handleRawChange}
          />
        );
      } else {
        return (
          <EmptyStatePane
            icon={<SvgIcon icon="bug" />}
            documentationLinks={[documentationLinks.introductionToInsomnia]}
            secondaryAction="Select a body type from above to send data in the body of a request"
            title="Enter a URL and send to get a response"
          />
        );
      }
    };

    return <NunjucksEnabledProvider disable={noRender}>{_render()}</NunjucksEnabledProvider>;
  }
}
