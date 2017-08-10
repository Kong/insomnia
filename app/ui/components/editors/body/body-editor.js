import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import RawEditor from './raw-editor';
import UrlEncodedEditor from './url-encoded-editor';
import FormEditor from './form-editor';
import FileEditor from './file-editor';
import {getContentTypeFromHeaders, CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FILE, CONTENT_TYPE_GRAPHQL} from '../../../../common/constants';
import {newBodyRaw, newBodyFormUrlEncoded, newBodyForm, newBodyFile} from '../../../../models/request';
import GraphQLEditor from './graph-ql-editor';

@autobind
class BodyEditor extends PureComponent {
  _handleRawChange (rawValue) {
    const {onChange, request} = this.props;

    const contentType = getContentTypeFromHeaders(request.headers);
    const newBody = newBodyRaw(rawValue, contentType || '');

    onChange(newBody);
  }

  _handleGraphQLChange (content) {
    const {onChange} = this.props;
    const newBody = newBodyRaw(content, CONTENT_TYPE_GRAPHQL);
    onChange(newBody);
  }

  _handleFormUrlEncodedChange (parameters) {
    const {onChange} = this.props;
    const newBody = newBodyFormUrlEncoded(parameters);
    onChange(newBody);
  }

  _handleFormChange (parameters) {
    const {onChange} = this.props;
    const newBody = newBodyForm(parameters);
    onChange(newBody);
  }

  _handleFileChange (path) {
    const {onChange} = this.props;
    const newBody = newBodyFile(path);
    onChange(newBody);
  }

  render () {
    const {
      keyMap,
      fontSize,
      indentSize,
      lineWrapping,
      request,
      handleRender: render,
      handleGetRenderContext: getRenderContext
    } = this.props;

    const noRender = request.settingDisableRenderRequestBody;
    const handleRender = noRender ? null : render;
    const handleGetRenderContext = noRender ? null : getRenderContext;

    const uniqueKey = `${request._id}::${noRender}`;

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
          request={request}
          fontSize={fontSize}
          indentSize={indentSize}
          content={request.body.text || ''}
          keyMap={keyMap}
          lineWrapping={lineWrapping}
          render={handleRender}
          getRenderContext={handleGetRenderContext}
          onChange={this._handleGraphQLChange}
        />
      );
    } else if (!isBodyEmpty) {
      const contentType = getContentTypeFromHeaders(request.headers) || mimeType;
      return (
        <RawEditor
          key={uniqueKey}
          fontSize={fontSize}
          indentSize={indentSize}
          keyMap={keyMap}
          lineWrapping={lineWrapping}
          contentType={contentType || 'text/plain'}
          content={request.body.text || ''}
          render={handleRender}
          getRenderContext={handleGetRenderContext}
          onChange={this._handleRawChange}
        />
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

BodyEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  handleUpdateRequestMimeType: PropTypes.func.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,

  // Optional
  fontSize: PropTypes.number,
  indentSize: PropTypes.number,
  keyMap: PropTypes.string,
  lineWrapping: PropTypes.bool
};

export default BodyEditor;
