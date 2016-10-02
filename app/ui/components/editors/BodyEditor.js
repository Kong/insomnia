import React, {PropTypes, Component} from 'react';
import Editor from '../base/Editor';
import KeyValueEditor from '../base/KeyValueEditor';
import {CONTENT_TYPE_FORM_URLENCODED} from '../../../backend/contentTypes';
import {getContentTypeFromHeaders} from '../../../backend/contentTypes';
import * as querystring from '../../../backend/querystring';

class BodyEditor extends Component {
  static _getBodyFromPairs (pairs) {
    // HACK: Form data needs to be encoded, but we shouldn't encode templating
    // Lets try out best to keep {% ... %} and {{ ... }} untouched


    // 1. Replace all template tags with urlencode-friendly tags

    const encodingMap = {};
    const re = /(\{\{\s*[^{}]+\s*}})|(\{%\s*[^{}]+\s*%})/g;
    const next = (s) => {
      const results = re.exec(s);
      if (results) {
        const key = `XYZ${Object.keys(encodingMap).length}ZYX`;
        const word = results[0];
        const index = results['index'];
        encodingMap[key] = word;
        const newS = `${s.slice(0, index)}${key}${s.slice(index + word.length)}`;
        return next(newS);
      }

      return s;
    };
    const encodedPairs = JSON.parse(next(JSON.stringify(pairs)));

    // 2. Generate the body

    const params = [];
    for (let {name, value} of encodedPairs) {
      params.push({name, value});
    }

    let body = querystring.buildFromParams(params, false);

    // 3. Put all the template tags back

    for (const key in encodingMap) {
      body = body.replace(key, encodingMap[key]);
    }

    return body;
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
            onChange={pairs => onChange(BodyEditor._getBodyFromPairs(pairs))}
            pairs={BodyEditor._getPairsFromBody(request.body)}
          />
        </div>
      )
    } else {
      return (
        <Editor
          manualPrettify={true}
          fontSize={fontSize}
          value={request.body}
          className={className}
          onChange={onChange}
          mode={contentType}
          lineWrapping={lineWrapping}
          placeholder="..."
        />
      )
    }
  }
}

BodyEditor.propTypes = {
  // Functions
  onChange: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired,

  // Optional
  fontSize: PropTypes.number,
  lineWrapping: PropTypes.bool
};

export default BodyEditor;
