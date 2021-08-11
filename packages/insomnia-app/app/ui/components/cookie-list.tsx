import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { cookieToString } from 'insomnia-cookies';
import React, { PureComponent } from 'react';
import * as toughCookie from 'tough-cookie';

import { AUTOBIND_CFG } from '../../common/constants';
import { HandleRender } from '../../common/render';
import type { Cookie } from '../../models/cookie-jar';
import { Dropdown, DropdownButton, DropdownItem } from './base/dropdown/index';
import PromptButton from './base/prompt-button';
import { showCookieModifyModal } from './modals/cookie-modify-modal';
import RenderedText from './rendered-text';

export interface CookieListProps {
  handleCookieAdd: () => void;
  handleCookieDelete: Function;
  handleDeleteAll: Function;
  cookies: Cookie[];
  newCookieDomainName: string;
  handleRender: HandleRender;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class CookieList extends PureComponent<CookieListProps> {
  _handleDeleteCookie(cookie: Cookie) {
    this.props.handleCookieDelete(cookie);
  }

  render() {
    const {
      cookies,
      handleCookieAdd,
      handleDeleteAll,
      handleRender,
    } = this.props;
    return (
      <div>
        <table className="table--fancy cookie-table table--striped">
          <thead>
            <tr>
              <th
                style={{
                  minWidth: '10rem',
                }}
              >
                Domain
              </th>
              <th
                style={{
                  width: '90%',
                }}
              >
                Cookie
              </th>
              <th
                style={{
                  width: '2rem',
                }}
                className="text-right"
              >
                <Dropdown right>
                  <DropdownButton
                    title="Add cookie"
                    className="btn btn--super-duper-compact btn--outlined txt-md"
                  >
                    Actions <i className="fa fa-caret-down" />
                  </DropdownButton>
                  <DropdownItem onClick={handleCookieAdd}>
                    <i className="fa fa-plus-circle" /> Add Cookie
                  </DropdownItem>
                  <DropdownItem onClick={handleDeleteAll} buttonClass={PromptButton}>
                    <i className="fa fa-trash-o" /> Delete All
                  </DropdownItem>
                </Dropdown>
              </th>
            </tr>
          </thead>
          <tbody key={cookies.length}>
            {cookies.map((cookie, i) => {
              const cookieString = cookieToString(toughCookie.Cookie.fromJSON(cookie));
              return (
                <tr className="selectable" key={i}>
                  <td>
                    <RenderedText render={handleRender}>{cookie.domain || ''}</RenderedText>
                  </td>
                  <td className="force-wrap wide">
                    <RenderedText render={handleRender}>{cookieString || ''}</RenderedText>
                  </td>
                  <td onClick={() => {}} className="text-right no-wrap">
                    <button
                      className="btn btn--super-compact btn--outlined"
                      onClick={() => { showCookieModifyModal(cookie); }}
                      title="Edit cookie properties"
                    >
                      Edit
                    </button>{' '}
                    <PromptButton
                      className="btn btn--super-compact btn--outlined"
                      addIcon
                      confirmMessage=""
                      onClick={() => this._handleDeleteCookie(cookie)}
                      title="Delete cookie"
                    >
                      <i className="fa fa-trash-o" />
                    </PromptButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cookies.length === 0 && (
          <div className="pad faint italic text-center">
            <p>I couldn't find any cookies for you.</p>
            <p>
              <button className="btn btn--clicky" onClick={handleCookieAdd}>
                Add Cookie <i className="fa fa-plus-circle" />
              </button>
            </p>
          </div>
        )}
      </div>
    );
  }
}

export default CookieList;
