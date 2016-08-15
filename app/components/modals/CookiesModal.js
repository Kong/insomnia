import React, {PropTypes, Component} from 'react';

import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import CookiesEditor from '../editors/CookiesEditor';
import * as db from '../../database';
import {DEBOUNCE_MILLIS} from '../../lib/constants';

class CookiesModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      cookieJar: null,
      filter: ''
    }
  }

  _saveChanges () {
    const {cookieJar} = this.state;
    db.cookieJarUpdate(cookieJar).then(() => {
      this._load();
    });
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
  }

  _handleCookieAdd (cookie) {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;
    cookieJar.cookies = [cookie, ...cookies];
    this._saveChanges(cookieJar);
  }

  _handleCookieDelete (cookie) {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;

    // NOTE: This is sketchy because it relies on the same reference
    cookieJar.cookies = cookies.filter(c => c !== cookie);

    this._saveChanges(cookieJar);
  }

  _onFilterChange (filter) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      this.setState({filter});
    }, DEBOUNCE_MILLIS);
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

  _load (workspace) {
    db.cookieJarGetOrCreateForWorkspace(workspace).then(cookieJar => {
      this.setState({cookieJar});
    });
  }

  show (workspace) {
    this.modal.show();
    this._load(workspace);
    this.filterInput.focus();
  }

  toggle (workspace) {
    this.modal.toggle();
    this._load(workspace);
    this.filterInput.focus();
  }

  render () {
    const filteredCookies = this._getFilteredSortedCookies();
    const {filter} = this.state;

    return (
      <Modal ref={m => this.modal = m} wide={true} top={true} tall={true} {...this.props}>
        <ModalHeader>
          Manage Cookies
        </ModalHeader>
        <ModalBody className="cookie-editor">
          <div className="cookie-editor__filter form-control form-control--outlined">
            <label className="label--small">Filter Cookies</label>
            <input
              ref={n => this.filterInput = n}
              onChange={e => this._onFilterChange(e.target.value)}
              type="text"
              placeholder="twitter.com"
              defaultValue=""
            />
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
          <div className="pull-right">
            <button className="btn" onClick={e => this.modal.hide()}>
              Done
            </button>
          </div>
          <div className="pad faint italic txt-sm tall">
            * cookies are automatically sent with relevant requests
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

CookiesModal.propTypes = {
  onChange: PropTypes.func.isRequired
};

// export CookiesModal;
export default CookiesModal;
