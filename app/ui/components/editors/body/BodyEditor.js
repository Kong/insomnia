import React, {PropTypes, PureComponent} from 'react';
import RawEditor from './RawEditor';
import UrlEncodedEditor from './UrlEncodedEditor';
import FormEditor from './FormEditor';
import FileEditor from './FileEditor';
import {getContentTypeFromHeaders, CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FILE} from '../../../../common/constants';
import {newBodyRaw, newBodyFormUrlEncoded, newBodyForm, newBodyFile} from '../../../../models/request';

class BodyEditor extends PureComponent {
  _handleRawChange = (rawValue) => {
    const {onChange, request} = this.props;

    const contentType = getContentTypeFromHeaders(request.headers);
    const newBody = newBodyRaw(rawValue, contentType || '');

    onChange(newBody);
  };

  _handleFormUrlEncodedChange = (parameters) => {
    const {onChange} = this.props;
    const newBody = newBodyFormUrlEncoded(parameters);
    onChange(newBody);
  };

  _handleFormChange = (parameters) => {
    const {onChange} = this.props;
    const newBody = newBodyForm(parameters);
    onChange(newBody);
  };

  _handleFileChange = (path) => {
    const {onChange} = this.props;
    const newBody = newBodyFile(path);
    onChange(newBody);
  };

  render () {
    const {fontSize, lineWrapping, request} = this.props;
    const fileName = request.body.fileName;
    const mimeType = request.body.mimeType;
    const isBodyEmpty = typeof mimeType !== 'string' && !request.body.text;

    if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
      return (
        <UrlEncodedEditor
          key={request._id}
          onChange={this._handleFormUrlEncodedChange}
          parameters={request.body.params || []}
        />
      )
    } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
      return (
        <FormEditor
          key={request._id}
          onChange={this._handleFormChange}
          parameters={request.body.params || []}
        />
      )
    } else if (mimeType === CONTENT_TYPE_FILE) {
      return (
        <FileEditor
          key={request._id}
          onChange={this._handleFileChange}
          path={fileName || ''}
        />
      )
    } else if (!isBodyEmpty) {
      const contentType = getContentTypeFromHeaders(request.headers) || mimeType;
      return (
        <RawEditor
          key={`${request._id}::${contentType}`}
          fontSize={fontSize}
          lineWrapping={lineWrapping}
          contentType={contentType || 'text/plain'}
          content={request.body.text || ''}
          onChange={this._handleRawChange}
        />
      )
    } else {
      return (
        <div className="pad valign-center text-center">
          <p className="pad super-faint text-sm text-center">
            <i className="fa fa-hand-peace-o" style={{fontSize: '8rem', opacity: 0.3}}></i>
            <br/><br/>
            Select a body type from above
          </p>
        </div>
      )
    }
  }
}

BodyEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  handleUpdateRequestMimeType: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,

  // Optional
  fontSize: PropTypes.number,
  lineWrapping: PropTypes.bool
};

export default BodyEditor;
