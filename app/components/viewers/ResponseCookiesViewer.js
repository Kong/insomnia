import React, {PropTypes} from 'react';
import {Cookie} from 'tough-cookie';

const ResponseCookiesViewer = ({headers}) => {
  if (!headers.length) {
    // Don't do anything if no cookies
    return <span className="faint">No cookies returned</span>;
  }

  return (
    <table className="wide table--striped">
      <thead>
      <tr>
        <th>Name</th>
        <th>Value</th>
      </tr>
      </thead>
      <tbody>
      {headers.map((h, i) => {
        const cookie = Cookie.parse(h.value);
        return (
          <tr className="selectable" key={i}>
            <td>{cookie.key}</td>
            <td className="force-wrap">{cookie.value}</td>
          </tr>
        );
      })}
      </tbody>
    </table>
  )
};

ResponseCookiesViewer.propTypes = {
  headers: PropTypes.array.isRequired
};

export default ResponseCookiesViewer;
