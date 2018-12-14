// @flow
import React, { PureComponent } from 'react';
import deepEqual from 'deep-equal';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import CookieList from '../cookie-list';
import * as models from '../../../models';
import type { Cookie, CookieJar } from '../../../models/cookie-jar';
import type { Workspace } from '../../../models/workspace';
import { fuzzyMatch } from '../../../common/misc';

type Props = {
  handleShowModifyCookieModal: Function,
  handleRender: (string | Object) => Promise<string | Object>,
  cookieJar: CookieJar,
  workspace: Workspace,
};

type State = {
  filter: string,
  visibleCookieIndexes: Array<number> | null,
};

@autobind
class CookiesModal extends PureComponent<Props, State> {
  modal: Modal | null;
  filterInput: HTMLInputElement | null;

  constructor(props: Props) {
    super(props);

    this.state = {
      filter: '',
      visibleCookieIndexes: null,
    };
  }

  _setModalRef(n: React.Component<*> | null) {
    this.modal = n;
  }

  _setFilterInputRef(n: HTMLInputElement | null) {
    this.filterInput = n;
  }

  async _saveChanges() {
    const { cookieJar } = this.props;
    await models.cookieJar.update(cookieJar);
  }

  async _handleCookieAdd(cookie: Cookie) {
    const { cookieJar } = this.props;
    const { cookies } = cookieJar;

    cookieJar.cookies = [cookie, ...cookies];
    await this._saveChanges();
  }

  async _handleDeleteAllCookies() {
    const { cookieJar } = this.props;
    cookieJar.cookies = [];
    await this._saveChanges();
  }

  async _handleCookieDelete(cookie: Cookie) {
    const { cookieJar } = this.props;
    const { cookies } = cookieJar;

    // NOTE: This is sketchy because it relies on the same reference
    cookieJar.cookies = cookies.filter(c => c.id !== cookie.id);

    await this._saveChanges();
  }

  async _handleFilterChange(e: Event) {
    if (!(e.target instanceof HTMLInputElement)) {
      return;
    }

    const filter = e.target.value;
    this._applyFilter(filter, this.props.cookieJar.cookies);
  }

  componentWillReceiveProps(nextProps: Props) {
    // Re-filter if we received new cookies
    // Compare cookies with Dates cast to strings
    const sameCookies = deepEqual(this.props.cookieJar.cookies, nextProps.cookieJar.cookies);

    if (!sameCookies) {
      this._applyFilter(this.state.filter, nextProps.cookieJar.cookies);
    }
  }

  async _applyFilter(filter: string, cookies: Array<Cookie>) {
    const renderedCookies = [];

    for (const cookie of cookies) {
      try {
        const renderedCookie = await this.props.handleRender(cookie);
        renderedCookies.push(renderedCookie);
      } catch (err) {
        // It's okay. Filter the raw version instead
        renderedCookies.push(cookie);
      }
    }

    let visibleCookieIndexes;

    if (filter) {
      visibleCookieIndexes = [];
      for (let i = 0; i < renderedCookies.length; i++) {
        const toSearch = JSON.stringify(renderedCookies[i]);
        const match = fuzzyMatch(filter, toSearch, { splitSpace: true });
        if (match) {
          visibleCookieIndexes.push(i);
        }
      }
    } else {
      visibleCookieIndexes = null;
    }

    this.setState({ filter, visibleCookieIndexes });
  }

  _getVisibleCookies() {
    const { cookieJar } = this.props;
    const { visibleCookieIndexes } = this.state;

    if (visibleCookieIndexes === null) {
      return cookieJar.cookies;
    }

    return cookieJar.cookies.filter((c, i) => visibleCookieIndexes.includes(i));
  }

  async show() {
    setTimeout(() => {
      this.filterInput && this.filterInput.focus();
    }, 100);

    // make sure the filter is up to date
    await this._applyFilter(this.state.filter, this.props.cookieJar.cookies);

    this.modal && this.modal.show();
  }

  hide() {
    this.modal && this.modal.hide();
  }

  render() {
    const { handleShowModifyCookieModal, handleRender, cookieJar } = this.props;

    const { filter } = this.state;

    const cookies = this._getVisibleCookies();

    return (
      <Modal ref={this._setModalRef} wide tall {...this.props}>
        <ModalHeader>Manage Cookies</ModalHeader>
        <ModalBody noScroll>
          {cookieJar && (
            <div className="cookie-list">
              <div className="pad">
                <div className="form-control form-control--outlined">
                  <label>
                    Filter Cookies
                    <input
                      ref={this._setFilterInputRef}
                      onChange={this._handleFilterChange}
                      type="text"
                      placeholder="twitter.com"
                      defaultValue=""
                    />
                  </label>
                </div>
              </div>
              <div className="cookie-list__list border-tops pad">
                <CookieList
                  cookies={cookies}
                  handleShowModifyCookieModal={handleShowModifyCookieModal}
                  handleRender={handleRender}
                  handleDeleteAll={this._handleDeleteAllCookies}
                  handleCookieAdd={this._handleCookieAdd}
                  handleCookieDelete={this._handleCookieDelete}
                  // Set the domain to the filter so that it shows up if we're filtering
                  newCookieDomainName={filter || 'domain.com'}
                />
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">
            * cookies are automatically sent with relevant requests
          </div>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

// export CookiesModal;
export default CookiesModal;
