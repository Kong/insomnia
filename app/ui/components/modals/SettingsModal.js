import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import {shell} from 'electron';
import Link from '../base/Link';
import PromptButton from '../base/PromptButton';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import KeyboardShortcutsTable from '../KeyboardShortcutsTable';
import * as GlobalActions from '../../redux/modules/global';
import * as db from '../../../backend/database';
import {
  getAppVersion,
  getAppName,
  getAppLongName
} from '../../../backend/appInfo';
import * as session from '../../../backend/sync/session';
import {showModal} from './index';
import SignupModal from './SignupModal';
import * as sync from '../../../backend/sync/index';


class SettingsTabs extends Component {
  constructor (props) {
    super(props);
    this._currentTabIndex = -1;
    this._currentVersion = null;
    this.state = {
      showSyncSetting: false
    }
  }

  _importFile () {
    const workspace = this._getActiveWorkspace(this.props);
    this.props.actions.global.importFile(workspace);
    this.props.hide();
  }

  _handleTabSelect (selectedIndex) {
    this._currentTabIndex = selectedIndex;
  }

  _exportAll () {
    this.props.actions.global.exportFile();
    this.props.hide();
  }

  _exportWorkspace () {
    this.props.actions.global.exportFile(this._getActiveWorkspace());
    this.props.hide();
  }

  _getActiveWorkspace (props) {
    // TODO: Factor this out into a selector

    const {entities, global} = props || this.props;
    let workspace = entities.workspaces[global.activeWorkspaceId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    return workspace;
  }

  componentWillReceiveProps ({selectedIndex, version}) {
    if (this._currentVersion !== version) {
      this._currentTabIndex = selectedIndex;
      this._currentVersion = version;
    }
  }

  render () {
    const {entities, hide} = this.props;
    const settings = entities.settings[Object.keys(entities.settings)[0]];

    return (
      <Tabs onSelect={i => this._handleTabSelect(i)}
            selectedIndex={this._currentTabIndex}>
        <TabList>
          <Tab selected={this._currentTabIndex === 0}>
            <button>General</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 1}>
            <button>Import/Export</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 2}>
            <button>Cloud Sync</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 3}>
            <button>Shortcuts</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 4}>
            <button>About</button>
          </Tab>
        </TabList>
        <TabPanel className="pad scrollable">
          <h2 className="txt-md">
            <label className="label--small">General Settings</label>
          </h2>
          <div>
            <input
              id="setting-show-passwords"
              type="checkbox"
              checked={settings.showPasswords}
              onChange={e => db.settings.update(settings, {showPasswords: e.target.checked})}
            />
            &nbsp;&nbsp;
            <label htmlFor="setting-show-passwords">
              Show passwords in plain-text
            </label>
          </div>

          <div className="pad-top">
            <input
              id="setting-bulk-header-editor"
              type="checkbox"
              checked={settings.useBulkHeaderEditor}
              onChange={e => db.settings.update(settings, {useBulkHeaderEditor: e.target.checked})}
            />
            &nbsp;&nbsp;
            <label htmlFor="setting-bulk-header-editor">
              Use bulk header editor by default
            </label>
          </div>

          <div className="pad-top">
            <input
              id="setting-follow-redirects"
              type="checkbox"
              checked={settings.followRedirects}
              onChange={e => db.settings.update(settings, {followRedirects: e.target.checked})}
            />
            &nbsp;&nbsp;
            <label htmlFor="setting-follow-redirects">
              Follow redirects automatically
            </label>
          </div>

          <div className="pad-top">
            <input
              id="setting-validate-ssl"
              type="checkbox"
              checked={settings.validateSSL}
              onChange={e => db.settings.update(settings, {validateSSL: e.target.checked})}
            />
            &nbsp;&nbsp;
            <label htmlFor="setting-validate-ssl">
              Validate SSL Certificates
            </label>
          </div>

          <div>
            <label htmlFor="setting-request-timeout" className="pad-top">
              Request Timeout (ms) (0 for no timeout)
            </label>
            <div className="form-control form-control--outlined no-margin">
              <input
                id="setting-request-timeout"
                type="number"
                min={0}
                value={settings.timeout}
                onChange={e => db.settings.update(settings, {timeout: parseInt(e.target.value, 10)})}
              />
            </div>
          </div>

          <br/>
          <h2 className="txt-md pad-top-sm">
            <label className="label--small">Code Editors</label>
          </h2>
          <div>
            <input
              id="setting-editor-line-wrapping"
              type="checkbox"
              checked={settings.editorLineWrapping}
              onChange={e => db.settings.update(settings, {editorLineWrapping: e.target.checked})}
            />
            &nbsp;&nbsp;
            <label htmlFor="setting-editor-line-wrapping">
              Wrap Long Lines
            </label>
          </div>
          <div>
            <label htmlFor="setting-editor-font-size" className="pad-top">
              Font Size (px)
            </label>
            <div className="form-control form-control--outlined no-margin">
              <input
                id="setting-editor-font-size"
                type="number"
                min={8}
                max={20}
                value={settings.editorFontSize}
                onChange={e => db.settings.update(settings, {editorFontSize: parseInt(e.target.value, 10)})}
              />
            </div>
          </div>

          <br/>
          <h2 className="txt-md pad-top-sm">
            <label className="label--small">Network Proxy (Experimental)</label>
          </h2>
          <div>
            <label htmlFor="setting-http-proxy">
              HTTP Proxy
            </label>
            <div className="form-control form-control--outlined no-margin">
              <input
                id="setting-http-proxy"
                type="string"
                placeholder="localhost:8005"
                defaultValue={settings.httpProxy}
                onChange={e => db.settings.update(settings, {httpProxy: e.target.value})}
              />
            </div>
          </div>
          <div className="pad-top-sm">
            <label htmlFor="setting-https-proxy">
              HTTPS Proxy
            </label>
            <div className="form-control form-control--outlined no-margin">
              <input
                id="setting-https-proxy"
                placeholder="localhost:8005"
                type="string"
                defaultValue={settings.httpsProxy}
                onChange={e => db.settings.update(settings, {httpsProxy: e.target.value})}
              />
            </div>
          </div>

          <br/>
          <h2 className="txt-md pad-top-sm">
            <label className="label--small">Other Settings</label>
          </h2>
          <div>
            <input
              id="setting-stacked-layout"
              type="checkbox"
              checked={settings.forceVerticalLayout}
              onChange={e => db.settings.update(settings, {forceVerticalLayout: e.target.checked})}
            />
            &nbsp;&nbsp;
            <label htmlFor="setting-stacked-layout">
              Force stacked layout
            </label>
          </div>
          <br/>
        </TabPanel>

        <TabPanel className="pad scrollable">
          <p>
            Be aware that you may be exporting <strong>private data</strong>.
            Also, any imported data may overwrite existing data.
          </p>
          <p>
            <button className="btn btn--super-compact btn--outlined"
                    onClick={e => this._importFile()}>
              Import
            </button>
            {" "}
            <button className="btn btn--super-compact btn--outlined"
                    onClick={e => this._exportAll()}>
              Export All Data
            </button>
            {" "}
            <button className="btn btn--super-compact btn--outlined"
                    onClick={e => this._exportWorkspace()}>
              Export Current Workspace
            </button>
          </p>
        </TabPanel>
        <TabPanel className="pad scrollable">
          <p>
            Cloud Sync is part of
            {" "}
            <Link href="https://insomnia.rest/plus">Insomnia Plus</Link> – a
            $5/month add-on to Insomnia.
          </p>
          <p>
            Plus provides end-to-end encrypted data sync across all your
            devices, while also acting as an up-to-date backup in case the
            worst happens.
          </p>

          {!session.isLoggedIn() ? (
            <p className="pad-top-sm">
              <button className="btn btn--super-compact btn--outlined"
                      onClick={() => {
                        hide();
                        showModal(SignupModal);
                        db.settings.update(settings, {optSyncBeta: true})
                      }}>
                Start 14 Day Trial
              </button>
            </p>
          ) : (
            <div>
              <p className="pad-top-sm">
                Hello {session.getFirstName()}!
              </p>
              <p>Thanks for signing up for Insomnia Plus.</p>
              <p>
                <PromptButton
                  className="btn btn--super-compact btn--outlined danger"
                  onClick={() => db.settings.update(settings, {optSyncBeta: false})}>
                  Close Account
                </PromptButton>
                {" "}
                <PromptButton
                  className="btn btn--super-compact btn--outlined warning"
                  onClick={() => {
                    db.settings.update(settings, {optSyncBeta: false});
                    sync.logout();
                    hide()
                  }}>
                  Disable Sync
                </PromptButton>
                {" "}
                <PromptButton className="btn btn--super-compact btn--outlined"
                              onClick={() => {
                                hide();
                                sync.logout()
                              }}>
                  Log Out
                </PromptButton>
              </p>
            </div>
          )}
        </TabPanel>
        <TabPanel className="pad scrollable">
          <KeyboardShortcutsTable />
        </TabPanel>
        <TabPanel className="pad scrollable">
          <h1>Hi there!</h1>
          <p>
            <Link href="http://insomnia.rest">
              {getAppName()}
            </Link> is made with love by me,
            {" "}
            <Link href="http://schier.co">Gregory Schier</Link>.
          </p>
          <p>
            You can help me out by sending your feedback to
            {" "}
            <Link href="mailto:support@insomnia.rest">
              support@insomnia.rest
            </Link>
            {" "}
            or tweet
            {" "}
            <Link href="https://twitter.com/GetInsomnia">@GetInsomnia</Link>.
          </p>
          <p>Thanks!</p>
          <br/>
          <p
            onDoubleClick={e => this.setState({showSyncSetting: !this.state.showSyncSetting})}>
            ~ Gregory
          </p>

          {this.state.showSyncSetting ? (
            <p className="italic faint">This setting has moved to the main
              panel.</p>
          ) : null}
        </TabPanel>
      </Tabs>
    );
  }
}

SettingsTabs.propTypes = {
  global: PropTypes.shape({
    activeWorkspaceId: PropTypes.string
  }),
  entities: PropTypes.shape({
    workspaces: PropTypes.object.isRequired,
    settings: PropTypes.object.isRequired
  }).isRequired,
  actions: PropTypes.shape({
    global: PropTypes.shape({
      importFile: PropTypes.func.isRequired,
      exportFile: PropTypes.func.isRequired,
    })
  }),

  // Optional
  selectedIndex: PropTypes.number,
  version: PropTypes.number
};

function mapStateToProps (state) {
  return {
    global: state.global,
    entities: state.entities,
    actions: state.actions,
    loading: state.global.loading
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: {
      global: bindActionCreators(GlobalActions, dispatch)
    }
  }
}


// NOTE: We can't _connect_ the SettingsModal because it hides the public methods
const ConnectedSettingsTabs = connect(
  mapStateToProps,
  mapDispatchToProps
)(SettingsTabs);


class SettingsModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      version: 0,
      selectedIndex: -1
    }
  }

  _setIndex (selectedIndex) {
    const version = this.state.version + 1;
    this.setState({selectedIndex, version});
  }

  show (selectedIndex = 0) {
    this.modal.show();
    this._setIndex(selectedIndex);
  }

  toggle (selectedIndex = 0) {
    this.modal.toggle();
    this._setIndex(selectedIndex);
  }

  render () {
    const {selectedIndex, version} = this.state;

    return (
      <Modal ref={m => this.modal = m} tall={true} {...this.props}>
        <ModalHeader>
          {getAppLongName()}
          &nbsp;&nbsp;
          <span className="faint txt-sm">v{getAppVersion()}</span>
        </ModalHeader>
        <ModalBody noScroll={true}>
          <ConnectedSettingsTabs
            version={version}
            hide={() => this.modal.hide()}
            selectedIndex={selectedIndex}
          />
        </ModalBody>
        <ModalFooter>
          <button className="btn" onClick={() => this.modal.hide()}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}
export default SettingsModal;
