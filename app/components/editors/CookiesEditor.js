import React, {PropTypes, Component} from 'react';
import {Cookie} from 'tough-cookie';

import {cookieToString} from '../../lib/cookies';

class CookiesEditor extends Component {
  _handleCookieUpdate (cookie, cookieStr) {
    const newCookie = Cookie.parse(cookieStr);
    this.props.onCookieUpdate(cookie, newCookie);
  }

  _handleCookieAdd () {
    const newCookie = new Cookie({
      key: 'foo',
      value: 'bar',
      domain: this.props.newCookieDomainName,
      path: '/'
    });
    this.props.onCookieAdd(newCookie);
  }

  _handleDeleteCookie (cookie) {
    this.props.onCookieDelete(cookie);
  }

  render () {
    const {cookies} = this.props;
    return (
      <table className="cookie-edit-table table--striped">
        <thead>
        <tr>
          <th style={{minWidth: '10rem'}}>Domain</th>
          <th style={{width: '90%'}}>Cookie</th>
          <th style={{width: '2rem'}} className="text-right">
            <button className="btn btn--super-compact"
                    onClick={e => this._handleCookieAdd()}
                    title="Add cookie">
              <i className="fa fa-plus-circle"></i>
            </button>
          </th>
        </tr>
        </thead>
        <tbody key={cookies.length}>
        {cookies.map((cookie, i) => {
          const cookieString = cookieToString(Cookie.fromJSON(JSON.stringify(cookie)));

          return (
            <tr className="selectable" key={i}>
              <td>
                {cookie.domain}
              </td>
              <td>
                <div className="form-control form-control--underlined no-margin">
                  <input
                    type="text"
                    defaultValue={cookieString}
                    onChange={e => this._handleCookieUpdate(cookie, e.target.value)}
                  />
                </div>
              </td>
              <td className="text-right">
                <button className="btn btn--super-compact"
                        onClick={e => this._handleDeleteCookie(cookie)}
                        title="Delete cookie">
                  <i className="fa fa-trash-o"></i>
                </button>
              </td>
            </tr>
          )
        })}
        </tbody>
      </table>
    );
  }
}

CookiesEditor.propTypes = {
  onCookieUpdate: PropTypes.func.isRequired,
  onCookieAdd: PropTypes.func.isRequired,
  onCookieDelete: PropTypes.func.isRequired,
  cookies: PropTypes.array.isRequired,
  newCookieDomainName: PropTypes.string.isRequired
};

export default CookiesEditor;
