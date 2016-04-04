import React, {Component, PropTypes} from 'react';
import CodeEditor from './base/Editor'

class RequestBodyEditor extends Component {
  shouldComponentUpdate (nextProps) {
    return this.props.request !== nextProps.request;
  }

  render () {
    const {request, onChange, className} = this.props;
    const contentTypeHeader = request.headers.find(h => h.name.toLowerCase() === 'content-type');
    const mode = contentTypeHeader ? contentTypeHeader.value : 'text/plain';

    return (
      <CodeEditor
        value={request.body}
        className={className}
        onChange={onChange}
        options={{
          mode: mode,
          placeholder: 'request body here...'
        }}
      />
    )
  }
}

RequestBodyEditor.propTypes = {
  request: PropTypes.shape({
    body: PropTypes.string.isRequired
  }).isRequired,
  onChange: PropTypes.func.isRequired
};

export default RequestBodyEditor;
