// @flow
import * as React from 'react';
import * as mimes from 'mime-types';
import clone from 'clone';
import autobind from 'autobind-decorator';
import RawEditor from './raw-editor';
import UrlEncodedEditor from './url-encoded-editor';
import FormEditor from './form-editor';
import FileEditor from './file-editor';
import {
  CONTENT_TYPE_FILE,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  CONTENT_TYPE_GRAPHQL,
  getContentTypeFromHeaders
} from '../../../../common/constants';
import type { Request, RequestBodyParameter } from '../../../../models/request';
import {
  newBodyFile,
  newBodyForm,
  newBodyFormUrlEncoded,
  newBodyRaw
} from '../../../../models/request';
import GraphQLEditor from './graph-ql-editor';
import { getContentTypeHeader } from '../../../../common/misc';
import type { Settings } from '../../../../models/settings';
import type { Workspace } from '../../../../models/workspace';
import { showModal } from '../../modals/index';
import AskModal from '../../modals/ask-modal';

type Props = {
  // Required
  onChange: Function,
  onChangeHeaders: Function,
  handleUpdateRequestMimeType: Function,
  handleRender: Function,
  handleGetRenderContext: Function,
  request: Request,
  workspace: Workspace,
  settings: Settings,
  environmentId: string
};

@autobind
class BodyEditor extends React.PureComponent<Props> {
  _handleRawChange(rawValue: string) {
    const { onChange, request } = this.props;

    const oldContentType = request.body.mimeType || '';
    const newBody = newBodyRaw(rawValue, oldContentType);

    onChange(newBody);
  }

  _handleGraphQLChange(content: string) {
    const { onChange } = this.props;
    const newBody = newBodyRaw(content, CONTENT_TYPE_GRAPHQL);
    onChange(newBody);
  }

  _handleFormUrlEncodedChange(parameters: Array<RequestBodyParameter>) {
    const { onChange } = this.props;
    const newBody = newBodyFormUrlEncoded(parameters);
    onChange(newBody);
  }

  _handleFormChange(parameters: Array<RequestBodyParameter>) {
    const { onChange } = this.props;
    const newBody = newBodyForm(parameters);
    onChange(newBody);
  }

  async _handleFileChange(path: string) {
    const { onChange, onChangeHeaders, request } = this.props;
    const headers = clone(request.headers);

    let contentTypeHeader = getContentTypeHeader(headers);

    if (!contentTypeHeader) {
      contentTypeHeader = { name: 'Content-Type', value: CONTENT_TYPE_FILE };
      headers.push(contentTypeHeader);
    }

    // Update Content-Type header if the user wants
    const contentType = contentTypeHeader.value;
    const newContentType = mimes.lookup(path) || CONTENT_TYPE_FILE;
    if (contentType !== newContentType) {
      contentTypeHeader.value = newContentType;
      showModal(AskModal, {
        title: 'Change Content-Type',
        message: (
          <p>
            Do you want set the <span className="monospace">Content-Type</span>{' '}
            header to <span className="monospace">{newContentType}</span>?
          </p>
        ),
        onDone: saidYes => {
          if (saidYes) {
            onChangeHeaders(headers);
          }
        }
      });
    }

    const newBody = newBodyFile(path);

    onChange(newBody);
  }

  render() {
    const {
      request,
      workspace,
      settings,
      environmentId,
      handleRender: render,
      handleGetRenderContext: getRenderContext
    } = this.props;

    const noRender = request.settingDisableRenderRequestBody;
    const handleRender = noRender ? null : render;
    const handleGetRenderContext = noRender ? null : getRenderContext;

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
          parameters={request.body.params || []}
        />
      );
    } else if (mimeType === CONTENT_TYPE_FILE) {
      return (
        <FileEditor
          key={uniqueKey}
          onChange={this._handleFileChange}
          path={fileName || ''}
        />
      );
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
          onChange={this._handleGraphQLChange}
        />
      );
    } else if (!isBodyEmpty) {
      const contentType =
        getContentTypeFromHeaders(request.headers) || mimeType;
      return (
        <RawEditor
          uniquenessKey={uniqueKey}
          fontSize={settings.editorFontSize}
          indentSize={settings.editorIndentSize}
          keyMap={settings.editorKeyMap}
          lineWrapping={settings.editorLineWrapping}
          contentType={contentType || 'text/plain'}
          content={request.body.text || ''}
          render={handleRender}
          getRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          onChange={this._handleRawChange}
        />
      );
    } else {
      return (
        <div className="overflow-hidden editor vertically-center text-center">
          <p className="pad super-faint text-sm text-center">
            <i
              className="fa fa-hand-peace-o"
              style={{ fontSize: '8rem', opacity: 0.3 }}
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

export default BodyEditor;
