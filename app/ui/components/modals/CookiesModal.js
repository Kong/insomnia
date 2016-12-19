import React, {PropTypes, Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import CookiesEditor from '../editors/CookiesEditor';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics/index';

class CookiesModal extends Component {
  state = {
    cookieJar: null,
    workspace: null,
    filter: ''
  };

  async _saveChanges () {
    const {cookieJar} = this.state;
    await models.cookieJar.update(cookieJar);
    this._load(this.state.workspace);
  }

  _handleCookieUpdate (oldCookie, cookie) {
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
  }

  _handleCookieAdd (cookie) {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;
    cookieJar.cookies = [cookie, ...cookies];
    this._saveChanges(cookieJar);
    trackEvent('Cookie', 'Create');
  }

  _handleCookieDelete (cookie) {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;

    // NOTE: This is sketchy because it relies on the same reference
    cookieJar.cookies = cookies.filter(c => c !== cookie);

    this._saveChanges(cookieJar);
    trackEvent('Cookie', 'Delete');
  }

  _onFilterChange (filter) {
    this.setState({filter});
    trackEvent('Cookie Editor', 'Filter Change');
  }

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
      <Modal ref={m => this.modal = m} wide={true} top={true} tall={true} {...this.props}>
        <ModalHeader>Manage Cookies</ModalHeader>
        <ModalBody className="cookie-editor">
          <div className="pad">
            <div className="form-control form-control--outlined">
              <label>Filter Cookies
                <input ref={n => this.filterInput = n}
                       onChange={e => this._onFilterChange(e.target.value)}
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
                onCookieUpdate={(oldCookie, cookie) => this._handleCookieUpdate(oldCookie, cookie)}
                onCookieAdd={cookie => this._handleCookieAdd(cookie)}
                onCookieDelete={cookie => this._handleCookieDelete(cookie)}
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
          <button className="btn" onClick={e => this.modal.hide()}>
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
