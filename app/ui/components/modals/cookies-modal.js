import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import CookieList from '../cookie-list';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics/index';

@autobind
class CookiesModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      cookieJar: null,
      filter: ''
    };
  }

  _setModalRef (n) {
    this.modal = n;
  }

  _setFilterInputRef (n) {
    this.filterInput = n;
  }

  async _saveChanges () {
    const {cookieJar} = this.state;
    await models.cookieJar.update(cookieJar);
    this._load();
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

  _handleFilterChange (e) {
    const filter = e.target.value;
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

  async _load () {
    const {workspace} = this.props;
    const cookieJar = await models.cookieJar.getOrCreateForWorkspace(workspace);
    this.setState({cookieJar});
  }

  async show () {
    await this._load();

    this.modal.show();

    setTimeout(() => this.filterInput.focus(), 100);
    trackEvent('Cookie Manager', 'Show');
  }

  hide () {
    this.modal.hide();
  }

  toggle () {
    if (this.modal.isOpen()) {
      this.hide();
    } else {
      this.show();
    }
  }

  render () {
    const filteredCookies = this._getFilteredSortedCookies();
    const {
      handleShowModifyCookieModal
    } = this.props;
    const {filter} = this.state;

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
            * click a cookie to modify it
          </div>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

CookiesModal.propTypes = {
  handleShowModifyCookieModal: PropTypes.func.isRequired,
  workspace: PropTypes.object.isRequired
};

// export CookiesModal;
export default CookiesModal;
