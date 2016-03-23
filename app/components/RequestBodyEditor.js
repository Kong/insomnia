import React, {Component, PropTypes} from 'react';
import CodeEditor from './base/Editor'

class RequestBodyEditor extends Component {
  shouldComponentUpdate (nextProps) {
    return this.props.request !== nextProps.request;
  }

  render () {
    const {request, onChange, className} = this.props;
    return (
      <CodeEditor
        value={request.body}
        className={className}
        onChange={onChange}
        options={{
          mode: request._mode,
          placeholder: 'request body here...'
        }}
      />
    )
  }
}

RequestBodyEditor.propTypes = {
  request: PropTypes.shape({
    body: PropTypes.string.isRequired,
    _mode: PropTypes.string.isRequired
  }).isRequired,
  onChange: PropTypes.func.isRequired
};

export default RequestBodyEditor;
