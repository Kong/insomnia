import React, {PropTypes, Component} from 'react';
import Editor from './base/Editor';
import KeyValueEditor from './base/KeyValueEditor';
import {CONTENT_TYPE_FORM_URLENCODED} from '../lib/contentTypes';
import {getContentTypeFromHeaders} from '../lib/contentTypes';
import * as querystring from '../lib/querystring';

class RequestBodyEditor extends Component {
  static _getBodyFromPairs (pairs) {
    const params = [];
    for (let {name, value} of pairs) {
      params.push({name, value});
    }

    return querystring.buildFromParams(params, false);
  }

  static _getPairsFromBody (body) {
    if (body === '') {
      return [];
    } else {
      return querystring.deconstructToParams(body, false);
    }
  }

  render () {
    const {
      fontSize,
      lineWrapping,
      request,
      onChange,
      className
    } = this.props;

    const contentType = getContentTypeFromHeaders(request.headers);

    if (contentType === CONTENT_TYPE_FORM_URLENCODED) {
      return (
        <div className="scrollable tall wide">
          <KeyValueEditor
            onChange={pairs => onChange(RequestBodyEditor._getBodyFromPairs(pairs))}
            pairs={RequestBodyEditor._getPairsFromBody(request.body)}
          />
        </div>
      )
    } else {
      return (
        <Editor
          fontSize={fontSize}
          value={request.body}
          className={className}
          onChange={onChange}
          mode={contentType}
          lineWrapping={lineWrapping}
          placeholder="request body here..."
        />
      )
    }
  }
}

RequestBodyEditor.propTypes = {
  // Functions
  onChange: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,

  // Optional
  fontSize: PropTypes.number,
  lineWrapping: PropTypes.bool
};

export default RequestBodyEditor;
