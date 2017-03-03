import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Cookie} from 'tough-cookie';

import PromptButton from '../base/PromptButton';
import CookieInput from '../CookieInput';
import {cookieToString} from '../../../common/cookies';
import {DEBOUNCE_MILLIS} from '../../../common/constants';

@autobind
class CookiesEditor extends PureComponent {
  _handleCookieAdd () {
    const newCookie = new Cookie({
      key: 'foo',
      value: 'bar',
      domain: this.props.newCookieDomainName,
      path: '/'
    });

    this.props.onCookieAdd(newCookie);
  }

  _handleCookieUpdate (cookie, cookieStr) {
    clearTimeout(this._cookieUpdateTimeout);
    this._cookieUpdateTimeout = setTimeout(() => {
      const newCookie = Cookie.parse(cookieStr);
      this.props.onCookieUpdate(cookie, newCookie);
    }, DEBOUNCE_MILLIS * 2);
  }

  _handleDeleteCookie (cookie) {
    this.props.onCookieDelete(cookie);
  }

  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.cookies !== this.props.cookies;
  }

  render () {
    const {cookies} = this.props;
    return (
      <div>
        <table className="cookie-edit-table table--striped">
          <thead>
          <tr>
            <th style={{minWidth: '10rem'}}>Domain</th>
            <th style={{width: '90%'}}>Cookie</th>
            <th style={{width: '2rem'}} className="text-right">
              <button className="btn btn--super-compact"
                      onClick={this._handleCookieAdd}
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
                <td>{cookie.domain}</td>
                <td>
                  <div className="form-control form-control--underlined no-margin">
                    <CookieInput
                      defaultValue={cookieString}
                      onChange={value => this._handleCookieUpdate(cookie, value)}
                    />
                  </div>
                </td>
                <td className="text-right">
                  <PromptButton className="btn btn--super-compact"
                                addIcon
                                confirmMessage=" "
                                onClick={e => this._handleDeleteCookie(cookie)}
                                title="Delete cookie">
                    <i className="fa fa-trash-o"></i>
                  </PromptButton>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
        {cookies.length === 0 ? (
            <div className="pad faint italic text-center">
              <p>
                I couldn't find any cookies for you.
              </p>
              <p>
                <button className="btn btn--clicky"
                        onClick={e => this._handleCookieAdd()}>
                  Add Cookie <i className="fa fa-plus-circle"></i>
                </button>
              </p>
            </div>
          ) : null}
      </div>
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
