import { autoBindMethodsForReact } from 'class-autobind-decorator';
import clone from 'clone';
import * as mimes from 'mime-types';
import React, { PureComponent } from 'react';

import {
  AUTOBIND_CFG,
  CONTENT_TYPE_FILE,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  CONTENT_TYPE_GRAPHQL,
  getContentTypeFromHeaders,
} from '../../../../common/constants';
import { getContentTypeHeader } from '../../../../common/misc';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
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
import { AskModal } from '../../modals/ask-modal';
import { showModal } from '../../modals/index';
import { FileEditor } from './file-editor';
import { FormEditor } from './form-editor';
import { GraphQLEditor } from './graph-ql-editor';
import { RawEditor } from './raw-editor';
import { UrlEncodedEditor } from './url-encoded-editor';

interface Props {
  onChange: (r: Request, body: RequestBody) => Promise<Request>;
  onChangeHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  handleUpdateRequestMimeType: (mimeType: string | null) => Promise<Request | null>;
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  request: Request;
  workspace: Workspace;
  settings: Settings;
  environmentId: string;
  isVariableUncovered: boolean;
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
    const newContentType = mimes.lookup(path) || CONTENT_TYPE_FILE;

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
      handleRender: render,
      handleGetRenderContext: getRenderContext,
      isVariableUncovered,
    } = this.props;
    const noRender = request.settingDisableRenderRequestBody;
    const handleRender = noRender ? undefined : render;
    const handleGetRenderContext = noRender ? undefined : getRenderContext;
    const uniqueKey = `${request._id}::${noRender ? 'no-render' : 'render'}`;
    const fileName = request.body.fileName;
    const mimeType = request.body.mimeType;
    const isBodyEmpty = typeof mimeType !== 'string' && !request.body.text;

    if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
      return (
        <UrlEncodedEditor
          key={uniqueKey}
          onChange={this._handleFormUrlEncodedChange}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
          parameters={request.body.params || []}
        />
      );
    } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
      return (
        <FormEditor
          key={uniqueKey}
          onChange={this._handleFormChange}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
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
          render={handleRender}
          workspace={workspace}
          settings={settings}
          environmentId={environmentId}
          getRenderContext={handleGetRenderContext}
          isVariableUncovered={isVariableUncovered}
          onChange={this._handleGraphQLChange}
        />
      );
    } else if (!isBodyEmpty) {
      const contentType = getContentTypeFromHeaders(request.headers) || mimeType;
      return (
        <RawEditor
          uniquenessKey={uniqueKey}
          fontSize={settings.editorFontSize}
          indentSize={settings.editorIndentSize}
          keyMap={settings.editorKeyMap}
          lineWrapping={settings.editorLineWrapping}
          indentWithTabs={settings.editorIndentWithTabs}
          contentType={contentType || 'text/plain'}
          content={request.body.text || ''}
          render={handleRender}
          getRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
          onChange={this._handleRawChange}
        />
      );
    } else {
      return (
        <div className="overflow-hidden editor vertically-center text-center">
          <p className="pad super-faint text-sm text-center">
            <i
              className="fa fa-hand-peace-o"
              style={{
                fontSize: '8rem',
                opacity: 0.3,
              }}
            />
            <br />
            <br />
            Select a body type from above
          </p>
        </div>
      );
    }
  }
}
