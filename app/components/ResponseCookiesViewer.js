import React, {PropTypes} from 'react';
import {Cookie} from 'tough-cookie';

const ResponseCookiesViewer = ({headers}) => {
  return (
    <table className="wide">
      <thead>
      <tr>
        <th>Name</th>
        <th>Value</th>
        <th>Domain</th>
        <th>Path</th>
        <th>Expires</th>
        <th>HTTP</th>
        <th>Secure</th>
      </tr>
      </thead>
      <tbody>
      {headers.map((h, i) => {
        const cookie = Cookie.parse(h.value);

        const expiresString = cookie.expires.toISOString ? cookie.expires.toISOString() : 'Never';
        return (
          <tr className="selectable" key={i}>
            <td>{cookie.key}</td>
            <td style={{maxWidth: '10rem'}} className="force-wrap">{cookie.value}</td>
            <td>{cookie.domain}</td>
            <td>{cookie.path}</td>
            <td>{expiresString}</td>
            <td>{cookie.httpOnly}</td>
            <td>{cookie.secure}</td>
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
