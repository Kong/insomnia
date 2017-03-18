import React, {PropTypes} from 'react';
import {Cookie} from 'tough-cookie';

const ResponseCookiesViewer = ({headers, showCookiesModal}) => {
  if (!headers.length) {
    // Don't do anything if no cookies
    return (
      <span className="faint">
        No cookies returned
      </span>
    );
  }

  return (
    <div>
      <table className="table--fancy table--striped">
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
              <td>{cookie ? cookie.key : 'n/a'}</td>
              <td className="force-wrap">{cookie ? cookie.value : 'malformed set-cookie header'}</td>
            </tr>
          );
        })}
        </tbody>
      </table>
      <p className="pad-top">
        <button className="pull-right btn btn--clicky"
                onClick={e => showCookiesModal()}>
          Manage Cookies
        </button>
      </p>
    </div>
  );
};

ResponseCookiesViewer.propTypes = {
  showCookiesModal: PropTypes.func.isRequired,
  headers: PropTypes.array.isRequired
};

export default ResponseCookiesViewer;
