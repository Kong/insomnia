import React, {PropTypes, Component} from 'react';
import RawEditor from './RawEditor';
import UrlEncodedEditor from './UrlEncodedEditor';
import FormEditor from './FormEditor';
import FileEditor from './FileEditor';
import {getContentTypeFromHeaders, CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_FORM_DATA} from '../../../../common/constants';
import {newBodyRaw, newBodyFormUrlEncoded, newBodyForm} from '../../../../models/request';
import {CONTENT_TYPE_FILE} from '../../../../common/constants';
import {newBodyFile} from '../../../../models/request';

class BodyEditor extends Component {
  constructor (props) {
    super(props);
    this._boundHandleRawChange = this._handleRawChange.bind(this);
    this._boundHandleFormUrlEncodedChange = this._handleFormUrlEncodedChange.bind(this);
    this._boundHandleFormChange = this._handleFormChange.bind(this);
    this._boundHandleFileChange = this._handleFileChange.bind(this);
  }

  _handleRawChange (rawValue) {
    const {onChange, request} = this.props;

    const contentType = getContentTypeFromHeaders(request.headers);
    const newBody = newBodyRaw(rawValue, contentType);

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
    const {fontSize, lineWrapping, request} = this.props;
    const bodyType = request.body.mimeType;
    const fileName = request.body.fileName;

    if (bodyType === CONTENT_TYPE_FORM_URLENCODED) {
      return (
        <UrlEncodedEditor
          key={request._id}
          onChange={this._boundHandleFormUrlEncodedChange}
          parameters={request.body.params || []}
        />
      )
    } else if (bodyType === CONTENT_TYPE_FORM_DATA) {
      return (
        <FormEditor
          key={request._id}
          onChange={this._boundHandleFormChange}
          parameters={request.body.params || []}
        />
      )
    } else if (bodyType === CONTENT_TYPE_FILE) {
      return (
        <FileEditor
          key={request._id}
          onChange={this._boundHandleFileChange}
          path={fileName || ''}
        />
      )
    } else {
      const contentType = getContentTypeFromHeaders(request.headers);
      return (
        <RawEditor
          key={`${request._id}::${contentType}`}
          fontSize={fontSize}
          lineWrapping={lineWrapping}
          contentType={contentType || 'text/plain'}
          content={request.body.text || ''}
          onChange={this._boundHandleRawChange}
        />
      )
    }
  }
}

BodyEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,

  // Optional
  fontSize: PropTypes.number,
  lineWrapping: PropTypes.bool
};

export default BodyEditor;
