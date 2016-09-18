import React, {Component} from 'react';
import request from 'request';

import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import {CHANGELOG_URL} from '../../../lib/constants';
import {getAppVersion} from '../../../lib/appInfo';

class ChangelogModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      startVersion: getAppVersion(),
      changelog: null
    };
  }

  show (startVersion = null) {
    this.modal.show();

    if (startVersion) {
      this.setState({startVersion});
    }
  }

  componentDidMount () {
    request.get(CHANGELOG_URL, (err, response) => {
      if (err) {
        console.warn('Failed to load changelog', err);
        return;
      }

      if (response.statusCode !== 200) {
        console.warn(
          'Failed to fetch changelog',
          response.statusCode,
          response.body
        );
        return;
      }

      let changelog;
      try {
        changelog = JSON.parse(response.body);
      } catch (e) {
        console.error('Failed to parse changelog', e);
        return;
      }

      this.setState({changelog});
    });
  }

  shouldComponentUpdate (nextProps, nextState) {
    return nextState !== this.state;
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

      let startIndex = changelog.findIndex(c => c.version === startVersion);
      if (startIndex < 0) {
        startIndex = 0;
        console.warn(`Failed to find changelog version for ${startVersion}`)
      }

      changelog.slice(startIndex).map((change, i) => {
        html = [
          ...html,
          <h1 key={`changes.${i}`}>v{change.version} Changes</h1>
        ];
        if (change.summary) {
          if (!Array.isArray(change.summary)) {
            html = [
              ...html,
              <p key={`summary.${i}`} dangerouslySetInnerHTML={{__html: change.summary}}/>
            ]
          } else {
            html = [
              ...html,
              <p key={`summary.${i}`}><strong dangerouslySetInnerHTML={{__html: change.summary[0]}}/></p>,
              ...change.summary.slice(1).map(
                (text, j) => <p key={`summary.${i}[${j}]`} dangerouslySetInnerHTML={{__html: text}}/>
              )
            ]
          }
        }

        if (change.major && change.major.length) {
          html = [
            ...html,
            <h3 key={`major.${i}`}>Noteworthy</h3>,
            <ul key={`major.${i}.list`}>
              {change.major.map((text, i) => <li key={i}>{text}</li>)}
            </ul>
          ];
        }

        if (change.fixes && change.fixes.length) {
          html = [
            ...html,
            <h3 key={`fixes.${i}`}>Fixes</h3>,
            <ul key={`fixes.${i}.list`}>
              {change.fixes.map((text, j) => <li key={j}>{text}</li>)}
            </ul>
          ];
        }

        if (change.minor && change.minor.length) {
          html = [
            ...html,
            <h3 key={`minor.${i}`}>Minor Changes</h3>,
            <ul key={`minor.${i}.list`}>
              {change.minor.map((text, i) => <li key={i}>{text}</li>)}
            </ul>
          ];
        }

        html = [
          ...html,
          <hr key={`hr.${i}`}/>
        ]
      });
    }

    return (
      <Modal ref={m => this.modal = m} {...this.props}>
        <ModalHeader>Insomnia Changelog</ModalHeader>
        <ModalBody className="pad changelog">
          {html}
        </ModalBody>
        <ModalFooter className="text-right">
          <div className="pull-right">
            <button className="btn" onClick={e => this.modal.hide()}>
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
