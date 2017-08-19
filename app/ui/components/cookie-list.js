import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {Cookie} from 'tough-cookie';

import {cookieToString} from '../../common/cookies';
import PromptButton from './base/prompt-button';

@autobind
class CookieList extends PureComponent {
  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.cookies !== this.props.cookies;
  }

  _handleCookieAdd () {
    const newCookie = new Cookie({
      key: 'foo',
      value: 'bar',
      domain: this.props.newCookieDomainName,
      path: '/',
      secure: false,
      httpOnly: false
    });

    this.props.onCookieAdd(newCookie);
  }

  _handleDeleteCookie (cookie) {
    this.props.onCookieDelete(cookie);
  }

  render () {
    const {
      cookies,
      handleShowModifyCookieModal
    } = this.props;

    return (
      <div>
        <table className="table--fancy cookie-table table--striped">
          <thead>
          <tr>
            <th style={{minWidth: '10rem'}}>Domain</th>
            <th style={{width: '90%'}}>Cookie</th>
            <th style={{width: '2rem'}} className="text-right">
              <button className="btn btn--super-compact"
                      onClick={this._handleCookieAdd}
                      title="Add cookie">
                <i className="fa fa-plus-circle"/>
              </button>
            </th>
          </tr>
          </thead>
          <tbody key={cookies.length}>
          {cookies.map((cookie, i) => {
            const cookieString = cookieToString(Cookie.fromJSON(JSON.stringify(cookie)));

            return (
              <tr className="selectable" key={i}>
                <td
                  onClick={() => handleShowModifyCookieModal(cookie)}>
                  {cookie.domain}
                </td>
                <td
                  onClick={() => handleShowModifyCookieModal(cookie)}>
                  {cookieString}
                </td>
                <td
                  onClick={null}
                  className="text-right">
                  <PromptButton className="btn btn--super-compact"
                                addIcon
                                confirmMessage=" "
                                onClick={e => this._handleDeleteCookie(cookie)}
                                title="Delete cookie">
                    <i className="fa fa-trash-o"/>
                  </PromptButton>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
        {cookies.length === 0 && (
          <div className="pad faint italic text-center">
            <p>
              I couldn't find any cookies for you.
            </p>
            <p>
              <button className="btn btn--clicky"
                      onClick={e => this._handleCookieAdd()}>
                Add Cookie <i className="fa fa-plus-circle"/>
              </button>
            </p>
          </div>
        )}
      </div>
    );
  }
}

CookieList.propTypes = {
  onCookieAdd: PropTypes.func.isRequired,
  onCookieDelete: PropTypes.func.isRequired,
  cookies: PropTypes.array.isRequired,
  newCookieDomainName: PropTypes.string.isRequired,
  handleShowModifyCookieModal: PropTypes.func.isRequired
};

export default CookieList;
