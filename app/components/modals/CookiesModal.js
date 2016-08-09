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
    db.cookieJarUpdate(cookieJar).then(j => this.modal.hide());
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

    this.setState({cookieJar});
  }

  _handleCookieAdd (cookie) {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;
    cookieJar.cookies = [...cookies, cookie];
    this.setState({cookieJar});
  }

  _handleCookieDelete (cookie) {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;
    cookieJar.cookies = cookies.filter(c => c.domain !== cookie.domain || c.key !== cookie.key);
    this.setState({cookieJar});
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
    }).sort((a, b) => {
      if (a.domain === b.domain) {
        return a.key.toLowerCase() > b.key.toLowerCase() ? 1 : -1;
      } else {
        return a.domain.toLowerCase() > b.domain.toLowerCase() ? 1 : -1;
      }
    });
  }

  _load (filter = '') {
    db.cookieJarAll().then(jars => {
      const cookieJar = jars[0];
      this.setState({cookieJar, filter});
    });
  }

  show (filter = '') {
    this.modal.show();
    this._load(filter);
    this.filterInput.focus();
  }

  toggle (filter = '') {
    this.modal.toggle();
    this._load(filter);
    this.filterInput.focus();
  }

  render () {
    const filteredCookies = this._getFilteredSortedCookies();

    return (
      <Modal ref={m => this.modal = m} wide={true} top={true} tall={true} {...this.props}>
        <ModalHeader>
          Cookies <span className="faint txt-sm">– manage cookies for domains</span>
        </ModalHeader>
        <ModalBody className="pad">
          <div className="form-control form-control--outlined">
            <label className="label--small">
              Search Cookies
            </label>
            <input
              ref={n => this.filterInput = n}
              onChange={e => this._onFilterChange(e.target.value)}
              type="text"
              placeholder="twitter.com"
              defaultValue=""
            />
          </div>
          <hr/>
          <CookiesEditor
            cookies={filteredCookies}
            onCookieUpdate={(oldCookie, cookie) => this._handleCookieUpdate(oldCookie, cookie)}
            onCookieAdd={cookie => this._handleCookieAdd(cookie)}
            onCookieDelete={cookie => this._handleCookieDelete(cookie)}
          />
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={e => this.modal.hide()}>
              Cancel
            </button>
            <button className="btn" onClick={e => this._saveChanges()}>
              Save
            </button>
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
