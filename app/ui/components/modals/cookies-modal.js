// @flow
import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import CookieList from '../cookie-list';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics/index';
import type {Cookie, CookieJar} from '../../../models/cookie-jar';
import type {Workspace} from '../../../models/workspace';

@autobind
class CookiesModal extends PureComponent {
  props: {
    handleShowModifyCookieModal: Function,
    handleRender: Function,
    cookieJar: CookieJar,
    workspace: Workspace
  };

  state: {
    filter: string
  };

  modal: Modal | null;
  filterInput: HTMLInputElement | null;

  constructor (props: any) {
    super(props);
    this.state = {
      filter: ''
    };
  }

  async _ensureCookieJarExists () {
    const {cookieJar, workspace} = this.props;
    if (!cookieJar) {
      models.cookieJar.getOrCreateForParentId(workspace._id);
    }
  }

  _setModalRef (n: React.Element<*> | null) {
    this.modal = n;
  }

  _setFilterInputRef (n: HTMLInputElement | null) {
    this.filterInput = n;
  }

  async _saveChanges () {
    const {cookieJar} = this.props;
    await models.cookieJar.update(cookieJar);
  }

  async _handleCookieAdd (cookie: Cookie) {
    const {cookieJar} = this.props;
    const {cookies} = cookieJar;

    cookieJar.cookies = [cookie, ...cookies];
    await this._saveChanges();
    trackEvent('Cookie', 'Create');
  }

  async _handleCookieDelete (cookie: Cookie) {
    const {cookieJar} = this.props;
    const {cookies} = cookieJar;

    // NOTE: This is sketchy because it relies on the same reference
    cookieJar.cookies = cookies.filter(c => c !== cookie);

    await this._saveChanges();
    trackEvent('Cookie', 'Delete');
  }

  _handleFilterChange (e: Event & {target: HTMLInputElement}) {
    const filter = e.target.value;
    this.setState({filter});
    trackEvent('Cookie Editor', 'Filter Change');
  }

  _getFilteredSortedCookies () {
    const {cookieJar} = this.props;
    const {filter} = this.state;

    const {cookies} = cookieJar;
    return cookies.filter(c => {
      const toSearch = JSON.stringify(c).toLowerCase();
      return toSearch.indexOf(filter.toLowerCase()) !== -1;
    });
  }

  async show () {
    await this._ensureCookieJarExists();

    setTimeout(() => {
      this.filterInput && this.filterInput.focus();
    }, 100);

    this.modal && this.modal.show();
    trackEvent('Cookie Manager', 'Show');
  }

  hide () {
    this.modal && this.modal.hide();
  }

  render () {
    const {
      handleShowModifyCookieModal,
      handleRender,
      cookieJar
    } = this.props;

    if (!cookieJar) {
      return null;
    }

    const {
      filter
    } = this.state;

    const filteredCookies = this._getFilteredSortedCookies();

    return (
      <Modal ref={this._setModalRef} wide tall {...this.props}>
        <ModalHeader>Manage Cookies</ModalHeader>
        <ModalBody className="cookie-list" noScroll>
          <div className="pad">
            <div className="form-control form-control--outlined">
              <label>Filter Cookies
                <input ref={this._setFilterInputRef}
                       onChange={this._handleFilterChange}
                       type="text"
                       placeholder="twitter.com"
                       defaultValue=""/>
              </label>
            </div>
          </div>
          <div className="cookie-list__list border-top">
            <div className="pad-top">
              <CookieList
                handleShowModifyCookieModal={handleShowModifyCookieModal}
                handleRender={handleRender}
                cookies={filteredCookies}
                onCookieAdd={this._handleCookieAdd}
                onCookieDelete={this._handleCookieDelete}
                // Set the domain to the filter so that it shows up if we're filtering
                newCookieDomainName={filter || 'domain.com'}
              />
            </div>
          </div>
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
