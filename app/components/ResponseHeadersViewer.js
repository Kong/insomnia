import React, {PropTypes} from 'react';
import CopyButton from './base/CopyButton';

const ResponseHeadersViewer = ({headers}) => {
  const headersString = headers.map(
    h => `${h.name}: ${h.value}`
  ).join('\n');

  return (
    <pre className="scrollable wide tall selectable monospace pad">
      {headersString}
    </pre>
  )
};

ResponseHeadersViewer.propTypes = {
  headers: PropTypes.array.isRequired
};

export default ResponseHeadersViewer;
