import React, {PropTypes, PureComponent} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import CookiesEditor from '../editors/CookiesEditor';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics/index';

class CookiesModal extends PureComponent {
  state = {
    cookieJar: null,
    workspace: null,
    filter: ''
  };

  _setModalRef = n => this.modal = n;
  _setFilterInputRef = n => this.filterInput = n;
  _hide = () => this.modal.hide();

  async _saveChanges () {
    const {cookieJar} = this.state;
    await models.cookieJar.update(cookieJar);
    this._load(this.state.workspace);
  }
  _handleCookieUpdate = (oldCookie, cookie) => {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;
    const index = cookies.findIndex(c => c.domain === oldCookie.domain && c.key === oldCookie.key);

    cookieJar.cookies = [
      ...cookies.slice(0, index),
      cookie,
      ...cookies.slice(index + 1)
    ];

    this._saveChanges(cookieJar);
    trackEvent('Cookie', 'Update');
  };

  _handleCookieAdd = cookie => {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;
    cookieJar.cookies = [cookie, ...cookies];
    this._saveChanges(cookieJar);
    trackEvent('Cookie', 'Create');
  };

  _handleCookieDelete = cookie => {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;

    // NOTE: This is sketchy because it relies on the same reference
    cookieJar.cookies = cookies.filter(c => c !== cookie);

    this._saveChanges(cookieJar);
    trackEvent('Cookie', 'Delete');
  };

  _handleFilterChange = e => {
    const filter = e.target.value;
    this.setState({filter});
    trackEvent('Cookie Editor', 'Filter Change');
  };

  _getFilteredSortedCookies () {
    const {cookieJar, filter} = this.state;

    if (!cookieJar) {
      // Nothing to do yet.
      return [];
    }

    const {cookies} = cookieJar;
    return cookies.filter(c => {
      const toSearch = JSON.stringify(c).toLowerCase();
      return toSearch.indexOf(filter.toLowerCase()) !== -1;
    });
  }

  async _load (workspace) {
    const cookieJar = await models.cookieJar.getOrCreateForWorkspace(workspace);
    this.setState({cookieJar, workspace});
  }

  async show (workspace) {
    await this._load(workspace);
    this.modal.show();
    this.filterInput.focus();
    trackEvent('Cookie Editor', 'Show');
  }

  toggle (workspace) {
    this.modal.toggle();
    this.filterInput.focus();
    this._load(workspace);
  }

  render () {
    const filteredCookies = this._getFilteredSortedCookies();
    const {filter} = this.state;

    return (
      <Modal ref={this._setModalRef} wide top tall {...this.props}>
        <ModalHeader>Manage Cookies</ModalHeader>
        <ModalBody className="cookie-editor" noScroll>
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
          <div className="cookie-editor__editor border-top">
            <div className="pad-top">
              <CookiesEditor
                cookies={filteredCookies}
                onCookieUpdate={this._handleCookieUpdate}
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
          <button className="btn" onClick={this._hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

CookiesModal.propTypes = {};

// export CookiesModal;
export default CookiesModal;
