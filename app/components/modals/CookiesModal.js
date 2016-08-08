import React, {PropTypes, Component} from 'react';
import {Cookie} from 'tough-cookie';

import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as db from '../../database';
import {cookieToString} from '../../lib/cookies';
import {DEBOUNCE_MILLIS} from '../../lib/constants';

class CookiesModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      cookies: [],
      filter: ''
    }
  }

  _saveChanges () {

  }

  _onFilterChange (filter) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      this.setState({filter});
    }, DEBOUNCE_MILLIS);
  }

  _getFilteredCookies () {
    const {cookies, filter} = this.state;

    return cookies.filter(c => {
      const toSearch = JSON.stringify(c).toLowerCase();
      return toSearch.indexOf(filter.toLowerCase()) !== -1;
    });
  }

  _load (filter = '') {
    db.cookieJarAll().then(jars => {
      const cookies = jars[0].cookies;
      this.setState({cookies, filter});
    });
  }

  show (filter = '') {
    this.modal.show();
    this._load(filter);
  }

  toggle (filter = '') {
    this.modal.toggle();
    this._load(filter);
  }

  render () {
    const filteredCookies = this._getFilteredCookies();

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
              ref={n => n && n.focus()}
              onChange={e => this._onFilterChange(e.target.value)}
              type="text"
              placeholder="twitter.com"
              defaultValue=""
            />
          </div>
          <hr/>
          <table className="cookie-edit-table table--striped">
            <thead>
            <tr>
              <th style={{minWidth: '10rem'}}>Domain</th>
              <th style={{width: '90%'}}>Cookie</th>
              <th style={{width: '2rem'}}></th>
            </tr>
            </thead>
            <tbody>
            {filteredCookies.map((cookie, i) => {
              const cookieString = cookieToString(Cookie.fromJSON(JSON.stringify(cookie)));

              return (
                <tr className="selectable" key={i}>
                  <td>
                    <div className="form-control form-control--underlined no-margin">
                      <input type="text" value={cookie.domain}/>
                    </div>
                  </td>
                  <td>
                    <div className="form-control form-control--underlined no-margin">
                      <input type="text" value={cookieString}/>
                    </div>
                  </td>
                  <td>
                    <button className="btn">
                      <i className="fa fa-trash-o"></i>
                    </button>
                  </td>
                </tr>
              )
            })}
            </tbody>
          </table>
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={this._saveChanges.bind(this)}>
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
