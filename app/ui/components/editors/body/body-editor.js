// @flow
import * as React from 'react';
import * as mimes from 'mime-types';
import clone from 'clone';
import autobind from 'autobind-decorator';
import RawEditor from './raw-editor';
import UrlEncodedEditor from './url-encoded-editor';
import FormEditor from './form-editor';
import FileEditor from './file-editor';
import {CONTENT_TYPE_FILE, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_GRAPHQL, getContentTypeFromHeaders, getContentTypeName} from '../../../../common/constants';
import type {RequestBody, RequestBodyParameter, RequestHeader} from '../../../../models/request';
import {newBodyFile, newBodyForm, newBodyFormUrlEncoded, newBodyRaw} from '../../../../models/request';
import GraphQLEditor from './graph-ql-editor';
import {getContentTypeHeader} from '../../../../common/misc';
import type {Settings} from '../../../../models/settings';
import type {Workspace} from '../../../../models/workspace';
import {showModal} from '../../modals/index';
import AskModal from '../../modals/ask-modal';

type Props = {|
  // Required
  onChange: Function,
  onChangeHeaders: Function,
  handleUpdateRequestMimeType: Function,
  handleRender: Function,
  handleGetRenderContext: Function,
  disableRender: boolean,
  body: RequestBody,
  requestId: string,
  headers: Array<RequestHeader>,
  inheritedBody: RequestBody | null,
  workspace: Workspace,
  settings: Settings,
  environmentId: string,
  nunjucksPowerUserMode: boolean,
  fontSize: number,
  indentSize: number,
  keyMap: string,
  lineWrapping: boolean
|};

@autobind
class BodyEditor extends React.PureComponent<Props> {
  _handleUpdateDisableInheritance (e: SyntheticEvent<HTMLInputElement>) {
    const {onChange, body} = this.props;
    const newBody = clone(body);
    newBody.disableInheritance = !e.currentTarget.checked;
    onChange(newBody);
  }

  _handleRawChange (rawValue: string) {
    const {onChange, headers} = this.props;

    const contentType = getContentTypeFromHeaders(headers);
    const newBody = newBodyRaw(rawValue, contentType || '');

    onChange(newBody);
  }

  _handleGraphQLChange (content: string) {
    const {onChange} = this.props;
    const newBody = newBodyRaw(content, CONTENT_TYPE_GRAPHQL);
    onChange(newBody);
  }

  _handleFormUrlEncodedChange (parameters: Array<RequestBodyParameter>) {
    const {onChange} = this.props;
    const newBody = newBodyFormUrlEncoded(parameters);
    onChange(newBody);
  }

  _handleFormChange (parameters: Array<RequestBodyParameter>) {
    const {onChange} = this.props;
    const newBody = newBodyForm(parameters);
    onChange(newBody);
  }

  async _handleFileChange (path: string) {
    const {onChange, onChangeHeaders, headers: originalHeaders} = this.props;
    const headers = clone(originalHeaders);

    let contentTypeHeader = getContentTypeHeader(headers);

    if (!contentTypeHeader) {
      contentTypeHeader = {name: 'Content-Type', value: CONTENT_TYPE_FILE};
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
            Do you want set the <span className="monospace">Content-Type</span> header
            to <span className="monospace">{newContentType}</span>?
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

  render () {
    const {
      keyMap,
      fontSize,
      indentSize,
      lineWrapping,
      requestId,
      headers,
      body,
      inheritedBody,
      workspace,
      settings,
      environmentId,
      disableRender,
      handleRender: render,
      handleGetRenderContext: getRenderContext,
      nunjucksPowerUserMode
    } = this.props;

    const handleRender = disableRender ? null : render;
    const handleGetRenderContext = disableRender ? null : getRenderContext;

    const uniqueKey = `${requestId}::${disableRender ? 'no-render' : 'render'}`;

    const fileName = body.fileName;
    const mimeType = body.mimeType;
    const isBodyEmpty = typeof mimeType !== 'string' && !body.text;

    if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
      return (
        <UrlEncodedEditor
          key={uniqueKey}
          onChange={this._handleFormUrlEncodedChange}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          parameters={body.params || []}
          inheritedParameters={(inheritedBody && inheritedBody.params) || []}
        />
      );
    } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
      return (
        <FormEditor
          key={uniqueKey}
          onChange={this._handleFormChange}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          parameters={body.params || []}
          inheritedParameters={(inheritedBody && inheritedBody.params) || []}
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
          requestId={requestId}
          fontSize={fontSize}
          indentSize={indentSize}
          content={body.text || ''}
          keyMap={keyMap}
          lineWrapping={lineWrapping}
          render={handleRender}
          workspace={workspace}
          settings={settings}
          environmentId={environmentId}
          getRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={this._handleGraphQLChange}
        />
      );
    } else if (!isBodyEmpty) {
      const contentType = getContentTypeFromHeaders(headers) || mimeType;
      return (
        <RawEditor
          key={uniqueKey}
          fontSize={fontSize}
          indentSize={indentSize}
          keyMap={keyMap}
          lineWrapping={lineWrapping}
          contentType={contentType || 'text/plain'}
          content={body.text || ''}
          render={handleRender}
          getRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          onChange={this._handleRawChange}
        />
      );
    } else if (inheritedBody) {
      return (
        <div className="overflow-hidden editor vertically-center text-center">
          <div className="pad super-faint text-sm text-center">
            <i className="fa fa-hand-peace-o" style={{fontSize: '8rem', opacity: 0.3}}/>
            <br/><br/>
            <div className="form-control">
              <label>
                <input
                  type="checkbox"
                  checked={!body.disableInheritance}
                  onChange={this._handleUpdateDisableInheritance}
                />
                Inherit {getContentTypeName(inheritedBody.mimeType) || 'body'} from parent
              </label>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="overflow-hidden editor vertically-center text-center">
          <p className="pad super-faint text-sm text-center">
            <i className="fa fa-hand-peace-o" style={{fontSize: '8rem', opacity: 0.3}}/>
            <br/><br/>
            Select a body type from above
          </p>
        </div>
      );
    }
  }
}

export default BodyEditor;
