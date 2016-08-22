import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'
import {shell} from 'electron';

import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import KeyboardShortcutsTable from '../KeyboardShortcutsTable';
import * as GlobalActions from '../../redux/modules/global';
import * as db from '../../database';
import {MASHAPE_URL} from '../../lib/constants';
import {getAppVersion} from '../../lib/appInfo';
import {getAppName, getAppLongName} from '../../lib/appInfo';


class SettingsTabs extends Component {
  constructor (props) {
    super(props);
    this._currentTabIndex = -1;
    this._currentVersion = null;
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

    const {entities, workspaces} = props || this.props;
    let workspace = entities.workspaces[workspaces.activeId];
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
    const {entities} = this.props;
    const settings = entities.settings[Object.keys(entities.settings)[0]];

    return (
      <Tabs onSelect={i => this._handleTabSelect(i)} selectedIndex={this._currentTabIndex}>
        <TabList>
          <Tab selected={this._currentTabIndex === 0}>
            <button>General</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 1}>
            <button>Editor</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 2}>
            <button>Import/Export</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 3}>
            <button>Shortcuts</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 4}>
            <button>About</button>
          </Tab>
        </TabList>
        <TabPanel className="pad">
          <h2 className="txt-md">
            <label className="label--small">General Settings</label>
          </h2>
          <div>
            <input
              id="setting-show-passwords"
              type="checkbox"
              checked={settings.showPasswords}
              onChange={e => db.settingsUpdate(settings, {showPasswords: e.target.checked})}
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
              onChange={e => db.settingsUpdate(settings, {useBulkHeaderEditor: e.target.checked})}
            />
            &nbsp;&nbsp;
            <label htmlFor="setting-follow-redirects">
              Use bulk header editor by default
            </label>
          </div>

          <div className="pad-top">
            <input
              id="setting-follow-redirects"
              type="checkbox"
              checked={settings.followRedirects}
              onChange={e => db.settingsUpdate(settings, {followRedirects: e.target.checked})}
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
              onChange={e => db.settingsUpdate(settings, {validateSSL: e.target.checked})}
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
                onChange={e => db.settingsUpdate(settings, {timeout: parseInt(e.target.value, 10)})}
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
                onChange={e => db.settingsUpdate(settings, {httpProxy: e.target.value})}
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
                onChange={e => db.settingsUpdate(settings, {httpsProxy: e.target.value})}
              />
            </div>
          </div>
        </TabPanel>
        <TabPanel className="pad">
          <label className="label--small">Code Editor Settings</label>
          <div className="pad-top">
            <input
              id="setting-editor-line-wrapping"
              type="checkbox"
              checked={settings.editorLineWrapping}
              onChange={e => db.settingsUpdate(settings, {editorLineWrapping: e.target.checked})}
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
                onChange={e => db.settingsUpdate(settings, {editorFontSize: parseInt(e.target.value, 10)})}
              />
            </div>
          </div>
        </TabPanel>
        <TabPanel className="pad">
          <p>This will export all app data for all workspaces.</p>
          <p>Be aware that you may be exporting <strong>private data</strong></p>
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
        <TabPanel className="pad">
          <KeyboardShortcutsTable />
        </TabPanel>
        <TabPanel className="pad">
          <h1>Hi there!</h1>
          <p>
            <Link href="http://insomnia.rest">{getAppName()}</Link> is made with love by me,&nbsp;
            <Link href="http://schier.co">Gregory Schier</Link>.
          </p>
          <p>
            You can help me out by sending your feedback to&nbsp;
            <Link href="mailto:support@insomnia.rest">support@insomnia.rest</Link> or tweet&nbsp;
            <Link href="https://twitter.com/GetInsomnia">@GetInsomnia</Link>.
          </p>
          <p>Thanks!</p>
          <br/>
          <p>~Gregory</p>
        </TabPanel>
      </Tabs>
    );
  }
}

SettingsTabs.propTypes = {
  workspaces: PropTypes.shape({
    activeId: PropTypes.string
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
    workspaces: state.workspaces,
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
        <ModalBody>
          <ConnectedSettingsTabs
            version={version}
            hide={() => this.modal.hide()}
            selectedIndex={selectedIndex}
          />
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={() => this.modal.hide()}>Done</button>
          </div>
          <div className="inline-block pad relative">
            Supported By&nbsp;&nbsp;
            <Link href={MASHAPE_URL}>
              <img src="images/mashape.png" style={{height: '1.5em'}} className="valign-bottom"/>
            </Link>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}
export default SettingsModal;
