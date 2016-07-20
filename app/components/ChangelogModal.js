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
        <div className="txt-lg">
          <i className="fa fa-refresh fa-spin"></i>
        </div>
      ];
    } else {
      html = [];

      changelog.map(change => {
        html = [
          ...html,
          <h1>v{change.version} Changes</h1>
        ];
        if (change.summary) {
          if (!Array.isArray(change.summary)) {
            html = [
              ...html,
              <p>{change.summary}</p>
            ]
          } else {
            html = [
              ...html,
              <p><strong>{change.summary[0]}</strong></p>,
              ...change.summary.slice(1).map(text => <p>{text}</p>)
            ]
          }
        }

        if (change.major && change.major.length) {
          html = [
            ...html,
            <h3>Noteworthy</h3>,
            <ul>{change.major.map(text => <li>{text}</li>)}</ul>
          ];
        }

        if (change.fixes && change.fixes.length) {
          html = [
            ...html,
            <h3>Fixes</h3>,
            <ul>{change.fixes.map(text => <li>{text}</li>)}</ul>
          ];
        }

        if (change.minor && change.minor.length) {
          html = [
            ...html,
            <h3>Minor Changes</h3>,
            <ul>{change.minor.map(text => <li>{text}</li>)}</ul>
          ];
        }

        html = [
          ...html,
          <hr/>
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
