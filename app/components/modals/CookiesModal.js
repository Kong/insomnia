import React, {PropTypes, Component} from 'react';

import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as db from '../../database';

class CookiesModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      cookies: []
    }
  }

  _saveChanges () {

  }

  _load () {
    db.cookieJarAll().then(jars => {
      const cookies = jars[0].data.cookies;
      this.setState({cookies});
    });
  }

  show () {
    this.modal.show();
    this._load();
  }

  toggle () {
    this.modal.toggle();
    this._load();
  }

  render () {
    const {cookies} = this.state;

    return (
      <Modal ref={m => this.modal = m} wide={true} top={true} tall={true} {...this.props}>
        <ModalHeader>
          Cookies <span className="faint txt-sm">– manage cookies for domains</span>
        </ModalHeader>
        <ModalBody>
          <div className="pad no-pad-bottom">
            <table className="cookie-edit-table table--striped">
              <thead>
              <tr>
                <th>Domain</th>
                <th>Name</th>
                <th>Value</th>
                <th>Expires</th>
                <th>Path</th>
                <th>HTTP</th>
                <th>Secure</th>
                <th></th>
              </tr>
              </thead>
              <tbody>
              {cookies.map((cookie, i) => {
                const expiresString = cookie.expires ? (new Date(cookie.expires)).toISOString() : 'Never';
                return (
                  <tr className="selectable" key={i}>
                    <td>
                      <div className="form-control form-control--underlined no-margin">
                        <input type="text" value={cookie.domain}/>
                      </div>
                    </td>
                    <td>
                      <div className="form-control form-control--underlined no-margin">
                        <input type="text" value={cookie.key}/>
                      </div>
                    </td>
                    <td>
                      <div className="form-control form-control--underlined no-margin">
                        <input type="text" value={cookie.value}/>
                      </div>
                    </td>
                    <td>
                      <div className="form-control form-control--underlined no-margin">
                        <input type="datetime" value={expiresString}/>
                      </div>
                    </td>
                    <td style={{width: '10%'}}>
                      <div className="form-control form-control--underlined no-margin">
                        <input type="text" value={cookie.path}/>
                      </div>
                    </td>
                    <td>
                      <input type="checkbox" value={cookie.httpOnly}/>
                    </td>
                    <td>
                      <input type="checkbox" value={cookie.secure}/>
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
          </div>
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
