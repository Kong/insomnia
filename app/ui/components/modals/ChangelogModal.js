import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import {getAppVersion, CHANGELOG_URL, CHANGELOG_PAGE} from '../../../common/constants';

@autobind
class ChangelogModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      changelog: null
    };
  }

  _setModalRef (m) {
    this.modal = m;
  }

  show () {
    this.modal.show();
  }

  toggle () {
    this.modal.toggle();
  }

  async componentDidMount () {
    let changelog;
    try {
      const response = await window.fetch(`${CHANGELOG_URL}?bust=${Date.now()}`);
      changelog = await response.json();
    } catch (e) {
      console.warn('Failed to fetch changelog', e);
      return;
    }

    this.setState({changelog});
  }

  render () {
    const {changelog} = this.state;

    let html;

    if (!changelog) {
      html = [
        <div key="spinner" className="txt-lg">
          <i className="fa fa-refresh fa-spin"></i>
        </div>
      ];
    } else {
      html = [];

      const startVersion = getAppVersion();
      let startIndex = changelog.findIndex(c => c.version === startVersion);
      if (startIndex < 0) {
        startIndex = 0;
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
              <p key={`summary.${i}`}>{change.summary}</p>
            ];
          } else {
            html = [
              ...html,
              <p key={`summary.${i}`}><strong>{change.summary[0]}</strong></p>,
              ...change.summary.slice(1).map(
                (text, j) => <p key={`summary.${i}[${j}]`}>{text}</p>
              )
            ];
          }
        }

        if (change.link) {
          html = [
            ...html,
            <Link href={change.link} className="btn btn--clicky" button key={`link.${i}`}>
              Read More
            </Link>
          ];
        }

        if (change.major && change.major.length) {
          html = [
            ...html,
            <h3 key={`major.${i}`}>Major</h3>,
            <ul key={`major.${i}.list`}>
              {change.major.map((text, i) => <li key={i}>{text}</li>)}
            </ul>
          ];
        }

        if (change.fixes && change.fixes.length) {
          html = [
            ...html,
            <h3 key={`fixes.${i}`}>Bug Fixes</h3>,
            <ul key={`fixes.${i}.list`}>
              {change.fixes.map((text, j) => <li key={j}>{text}</li>)}
            </ul>
          ];
        }

        if (change.minor && change.minor.length) {
          html = [
            ...html,
            <h3 key={`minor.${i}`}>Minor</h3>,
            <ul key={`minor.${i}.list`}>
              {change.minor.map((text, i) => <li key={i}>{text}</li>)}
            </ul>
          ];
        }

        html = [
          ...html,
          <hr key={`hr.${i}`}/>
        ];
      });
    }

    return (
      <Modal ref={this._setModalRef} {...this.props}>
        <ModalHeader>Insomnia Changelog</ModalHeader>
        <ModalBody className="pad changelog">
          {html}
        </ModalBody>
        <ModalFooter>
          <Link className="btn" href={CHANGELOG_PAGE} button>
            Visit Full Changelog
          </Link>
        </ModalFooter>
      </Modal>
    );
  }
}

ChangelogModal.propTypes = {};

export default ChangelogModal;
