import React, {PropTypes} from 'react';
import CopyButton from '../base/CopyButton';

const ResponseHeadersViewer = ({headers}) => {
  const headersString = headers.map(
    h => `${h.name}: ${h.value}`
  ).join('\n');

  return (
    <div>
      <table className="wide table--striped">
        <thead>
        <tr>
          <th>Name</th>
          <th>Value</th>
        </tr>
        </thead>
        <tbody>
        {headers.map((h, i) => (
          <tr className="selectable" key={i}>
            <td style={{width: '50%'}} className="force-wrap">{h.name}</td>
            <td style={{width: '50%'}} className="force-wrap">{h.value}</td>
          </tr>
        ))}
        </tbody>
      </table>
      <p className="pad-top">
        <CopyButton
          className="pull-right btn btn--super-compact btn--outlined"
          content={headersString}
        />
      </p>
    </div>
  )
};

ResponseHeadersViewer.propTypes = {
  headers: PropTypes.array.isRequired
};

export default ResponseHeadersViewer;
