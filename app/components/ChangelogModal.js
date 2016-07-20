import React from 'react';
import request from 'request';

import Modal from './base/Modal';
import ModalBody from './base/ModalBody';
import ModalHeader from './base/ModalHeader';
import ModalFooter from './base/ModalFooter';
import ModalComponent from './lib/ModalComponent';
import {CHANGELOG_URL} from '../lib/constants';

class ChangelogModal extends ModalComponent {
  constructor (props) {
    super(props);
    this.state = {
      startVersion: null,
      changelog: null
    };
  }

  show (startVersion) {
    super.show();

    request.get(CHANGELOG_URL, (err, response) => {
      if (err) {
        console.error('Failed to load changelog', err);
        return;
      }

      let changelog;
      try {
        changelog = JSON.parse(response.body);
      } catch (e) {
        console.error('Failed to parse changelog', e);
        return;
      }

      this.setState({changelog, startVersion});
    });
  }

  render () {
    const {changelog, startVersion} = this.state;

    let html;

    if (!changelog) {
      html = [
        <div key="spinner" className="txt-lg">
          <i className="fa fa-refresh fa-spin"></i>
        </div>
      ];
    } else {
      html = [];

      changelog.map(change => {
        html = [
          ...html,
          <h1 key="changes">v{change.version} Changes</h1>
        ];
        if (change.summary) {
          if (!Array.isArray(change.summary)) {
            html = [
              ...html,
              <p key="summary">{change.summary}</p>
            ]
          } else {
            html = [
              ...html,
              <p key="summary"><strong>{change.summary[0]}</strong></p>,
              ...change.summary.slice(1).map((text, i) => <p key={`summary[${i}]`}>{text}</p>)
            ]
          }
        }

        if (change.major && change.major.length) {
          html = [
            ...html,
            <h3 key="major">Noteworthy</h3>,
            <ul key="major.list">
              {change.major.map((text, i) => <li key={i}>{text}</li>)}
            </ul>
          ];
        }

        if (change.fixes && change.fixes.length) {
          html = [
            ...html,
            <h3 key="fixes">Fixes</h3>,
            <ul key="fixes.list">
              {change.fixes.map(text => <li>{text}</li>)}
              </ul>
          ];
        }

        if (change.minor && change.minor.length) {
          html = [
            ...html,
            <h3 key="minor">Minor Changes</h3>,
            <ul key="minor.list">
              {change.minor.map((text, i) => <li key={i}>{text}</li>)}
              </ul>
          ];
        }

        html = [
          ...html,
          <hr key="hr"/>
        ]
      });
    }

    return (
      <Modal ref="modal" {...this.props}>
        <ModalHeader>Insomnia Changelog</ModalHeader>
        <ModalBody className="pad changelog">
          {html}
        </ModalBody>
        <ModalFooter className="text-right">
          <div className="pull-right">
            <button className="btn" onClick={e => this.hide()}>
              Close
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

ChangelogModal.propTypes = {};

export default ChangelogModal;
