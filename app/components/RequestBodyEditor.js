import React, {Component, PropTypes} from 'react';
import Editor from './base/Editor'

class RequestBodyEditor extends Component {
  shouldComponentUpdate (nextProps) {
    return this.props.request !== nextProps.request;
  }

  render () {
    const {request, onChange, className} = this.props;
    // console.log(request);
    // const mode = request.contentType || 'application/json';
    const mode = 'application/json';

    return (
      <Editor
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
